import { Client, Wallet } from "xrpl";
import { deriveRootKey } from "../crypto/vaultCrypto.js";
import { createXVaultClient } from "../sdk/xvaultClient.js";
import { loadCliConfig } from "./config.js";
import { createFixtureRuntime } from "./fixtureRuntime.js";
import { openLocalStore } from "./localStore.js";

export async function runCreateVault(opts, globalOpts) {
  const type = opts.type ?? "individual";
  if (type !== "individual") {
    throw createCliError("SLICE_INDIVIDUAL_ONLY", "This CLI slice supports --type individual only. Team mode is out of scope.");
  }
  const runtime = await openRuntime(globalOpts);
  try {
    const created = await runtime.sdk.createVault({ type: "individual" });
    runtime.store.saveVault({
      vaultId: created.vaultId,
      saltHex: created.saltHex,
      type: "individual"
    });
    const result = {
      vaultId: created.vaultId,
      type: "individual",
      manifestTokenId: created.manifestTokenId,
      uriTokenId: created.uriTokenId ?? created.manifestTokenId,
      mintMode: created.mintMode ?? "simulated",
      network: created.network ?? "testnet"
    };
    emit(globalOpts, result, formatCreate(result));
    return result;
  } finally {
    await runtime.sdk.close();
    await runtime.disconnect?.();
  }
}

export async function runAddEntry(opts, globalOpts) {
  if (!opts.vault) {
    throw createCliError("INVALID_INPUT", "--vault is required.");
  }
  if (!opts.service) {
    throw createCliError("INVALID_INPUT", "--service is required.");
  }
  const runtime = await openRuntime(globalOpts);
  try {
    const added = await runtime.sdk.addEntry(opts.vault, {
      service: opts.service,
      username: opts.username,
      password: opts.password,
      notes: opts.notes
    });
    const result = {
      vaultId: opts.vault,
      cid: added.cid,
      tokenId: added.tokenId,
      service: opts.service,
      username: opts.username ?? null,
      network: added.network ?? "testnet"
    };
    emit(globalOpts, result, formatAdd(result));
    return result;
  } finally {
    await runtime.sdk.close();
    await runtime.disconnect?.();
  }
}

export async function runList(opts, globalOpts) {
  const runtime = await openRuntime(globalOpts);
  try {
    const listed = await runtime.sdk.list({ vaultId: opts.vault });
    emit(globalOpts, listed, formatList(listed));
    return listed;
  } finally {
    await runtime.sdk.close();
    await runtime.disconnect?.();
  }
}

async function openRuntime(globalOpts) {
  const config = loadCliConfig(globalOpts);
  if (config.fixture) {
    if (!config.masterPassword) {
      throw createCliError("MISSING_MASTER_PASSWORD", "Set XVAULT_MASTER_PASSWORD for fixture add-entry / create-vault.");
    }
    return createFixtureRuntime(config);
  }

  const missing = [];
  if (!config.hotpocketWsUrl) missing.push("HOTPOCKET_WS_URL");
  if (!config.xrplSeed) missing.push("XRPL_SEED");
  if (!config.quicknode.apiKey) missing.push("QUICKNODE_IPFS_API_KEY");
  if (!config.quicknode.gateway) missing.push("QUICKNODE_GATEWAY");
  if (!config.masterPassword) missing.push("XVAULT_MASTER_PASSWORD");
  if (missing.length > 0) {
    throw createCliError(
      "ENV_CLASS_OPEN",
      `Live runtime is not configured (${missing.join(", ")}). Use --fixture for this slice. See docs/individual-create-add-list-fixture.md.`
    );
  }

  const xrplClient = new Client(config.xrplWsUrl);
  await xrplClient.connect();
  const wallet = Wallet.fromSeed(config.xrplSeed);
  const store = openLocalStore(config.home);
  const sdk = createXVaultClient({
    hotpocketWsUrl: config.hotpocketWsUrl,
    xrplClient,
    wallet,
    quicknodeConfig: config.quicknode,
    rootKeyProvider: async ({ vaultId }) => {
      const salt = store.getSalt(vaultId);
      if (!salt) {
        throw createCliError("MISSING_VAULT_SALT", "Vault salt missing from local store. Run create-vault first.");
      }
      return deriveRootKey(config.masterPassword, salt);
    },
    getVaultSalt: async (vaultId) => store.getSalt(vaultId)
  });
  return {
    sdk,
    store,
    disconnect: async () => {
      if (xrplClient.isConnected()) await xrplClient.disconnect();
    }
  };
}

function emit(globalOpts, data, text) {
  if (globalOpts.json) {
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }
  process.stdout.write(`${text}\n`);
}

function formatCreate(result) {
  return [
    `vault ${result.vaultId}`,
    `uriToken ${result.uriTokenId}`,
    `network ${result.network}`,
    `mintMode ${result.mintMode}`
  ].join("\n");
}

function formatAdd(result) {
  return [`vault ${result.vaultId}`, `cid ${result.cid}`, `token ${result.tokenId}`, `service ${result.service}`].join("\n");
}

function formatList(listed) {
  if (!listed.vaults?.length) return "No vaults.";
  const lines = [];
  for (const vault of listed.vaults) {
    lines.push(`vault ${vault.vaultId} type=${vault.type ?? "individual"} token=${vault.manifestTokenId ?? ""}`);
    if (!vault.entries?.length) {
      lines.push("  (no entries)");
      continue;
    }
    for (const entry of vault.entries) {
      const service = entry.metadata?.service ?? "";
      const username = entry.metadata?.username ?? "";
      lines.push(`  [${entry.index}] ${service} ${username} cid=${entry.cid} token=${entry.tokenId}`);
    }
  }
  return lines.join("\n");
}

function createCliError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
