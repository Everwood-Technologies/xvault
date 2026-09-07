import fs from "node:fs";
import path from "node:path";
import { Wallet } from "xrpl";
import { deriveRootKey } from "../crypto/vaultCrypto.js";
import { createXVaultClient } from "../sdk/xvaultClient.js";
import { createFileBackedMockIpfs } from "../fixtures/mockIpfs.js";
import { observeFixtureIssuerAccount } from "../fixtures/accountObservation.js";
import { openLocalStore } from "./localStore.js";

/**
 * Local fixture runtime: in-process HotPocket contract state + mock QuickNode
 * IPFS + simulated Xahau testnet URI mint. No production credentials.
 *
 * The contract module binds XVAULT_STATE_FILE at import time, so it is loaded
 * only after the fixture env is assigned.
 */
export async function createFixtureRuntime(config) {
  fs.mkdirSync(config.home, { recursive: true });
  process.env.XVAULT_STATE_FILE = config.stateFile;
  process.env.XVAULT_DEV_XRPL_FALLBACK = process.env.XVAULT_DEV_XRPL_FALLBACK ?? "true";
  process.env.ENABLE_TEAM_MODE = process.env.ENABLE_TEAM_MODE ?? "false";

  const wallet = loadOrCreateEphemeralWallet(config.home);
  const ipfs = createFileBackedMockIpfs(config.ipfsFile, config.quicknode.gateway);
  const store = openLocalStore(config.home);

  // Env-timing: contract singleton reads XVAULT_STATE_FILE on first import.
  const { handleOperation } = await import("../contract/index.js");

  let round = Number(process.env.XVAULT_FIXTURE_ROUND ?? "0");
  const submitContractRequest = async (op) => {
    round += 1;
    process.env.XVAULT_FIXTURE_ROUND = String(round);
    const info = console.info;
    console.info = () => {};
    try {
      return await handleOperation(op, { xrplClient: null }, { roundKey: String(round) });
    } finally {
      console.info = info;
    }
  };

  const sdk = createXVaultClient({
    hotpocketWsUrl: "ws://fixture.invalid",
    xrplClient: createFixtureXrplClient(wallet),
    wallet,
    quicknodeConfig: {
      gateway: config.quicknode.gateway
    },
    ipfsClient: ipfs,
    submitContractRequest,
    rootKeyProvider: async ({ vaultId }) => {
      const salt = store.getSalt(vaultId);
      if (!salt) {
        throw createCliError("MISSING_VAULT_SALT", "Vault salt missing from local fixture store. Run create-vault first.");
      }
      if (!config.masterPassword) {
        throw createCliError("MISSING_MASTER_PASSWORD", "XVAULT_MASTER_PASSWORD is required.");
      }
      return deriveRootKey(config.masterPassword, salt);
    },
    getVaultSalt: async (vaultId) => store.getSalt(vaultId)
  });

  return {
    sdk,
    wallet,
    store,
    ipfs,
    issuerObservation: observeFixtureIssuerAccount()
  };
}

function loadOrCreateEphemeralWallet(homeDir) {
  const walletPath = path.join(homeDir, "ephemeral-wallet.json");
  if (fs.existsSync(walletPath)) {
    const saved = JSON.parse(fs.readFileSync(walletPath, "utf8"));
    if (typeof saved?.seed !== "string" || saved.seed.length === 0) {
      throw createCliError("INVALID_FIXTURE_WALLET", "Fixture wallet file is missing a seed.");
    }
    return Wallet.fromSeed(saved.seed);
  }
  const wallet = Wallet.generate();
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(
    walletPath,
    `${JSON.stringify({ seed: wallet.seed, classicAddress: wallet.classicAddress }, null, 2)}\n`,
    { mode: 0o600 }
  );
  return wallet;
}

function createFixtureXrplClient(wallet) {
  return {
    request: async () => ({
      result: {
        account_data: {
          SigningPubKey: wallet.publicKey,
          SignerList: null
        }
      }
    })
  };
}

function createCliError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
