import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { Wallet } from "xrpl";
import { CLIENT_CRYPTO_PROFILE, deriveRootKey } from "../../src/crypto/vaultCrypto.js";
import {
  assertCidRecorded,
  assertClientCryptoProfile,
  assertContractMetadataOnly,
  assertEncryptedBlobEnvelope,
  assertEverwoodSignerListOff,
  assertRepoIsXvault,
  assertTestnetUriMint,
  redactSnapshot
} from "../../src/fixtures/hardGates.js";
import { createFileBackedMockIpfs } from "../../src/fixtures/mockIpfs.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(repoRoot, "bin/xvault-cli.js");

function runCli(args, env) {
  const stdout = execFileSync(process.execPath, [cliPath, ...args], {
    env,
    encoding: "utf8",
    cwd: repoRoot
  });
  return JSON.parse(stdout.trim());
}

describe("individual create-vault → add-entry → list fixture", () => {
  test("CLI fixture flow records CID-only contract state and lists the added entry", async () => {
    assertRepoIsXvault(repoRoot);
    const cryptoProfile = assertClientCryptoProfile();
    expect(cryptoProfile.kdf).toBe("argon2id");
    expect(cryptoProfile.aead).toBe("AES-256-GCM");
    expect(CLIENT_CRYPTO_PROFILE.kdf).toBe("argon2id");

    const home = fs.mkdtempSync(path.join(os.tmpdir(), "xvault-individual-fixture-"));
    const masterPassword = `master-${Wallet.generate().classicAddress.slice(-8)}`;
    const entryPassword = `entry-${Wallet.generate().classicAddress.slice(-8)}`;
    const env = {
      ...process.env,
      XVAULT_RUNTIME: "fixture",
      XVAULT_HOME: home,
      XVAULT_STATE_FILE: path.join(home, "contract-state.json"),
      XVAULT_FIXTURE_IPFS_FILE: path.join(home, "ipfs-store.json"),
      XVAULT_MASTER_PASSWORD: masterPassword,
      ENABLE_TEAM_MODE: "false"
    };

    const created = runCli(["--fixture", "--json", "create-vault", "--type", "individual"], env);
    expect(created.vaultId).toMatch(/^[0-9a-f]{64}$/);
    assertTestnetUriMint(created);

    const added = runCli(
      [
        "--fixture",
        "--json",
        "add-entry",
        "--vault",
        created.vaultId,
        "--service",
        "github",
        "--username",
        "alice",
        "--password",
        entryPassword
      ],
      env
    );
    expect(added.cid).toMatch(/^b[a-z2-7]{20,}$/);
    expect(added.vaultId).toBe(created.vaultId);
    expect(added.service).toBe("github");

    const listed = runCli(["--fixture", "--json", "list"], env);
    expect(listed.network).toBe("testnet");
    expect(listed.vaults).toHaveLength(1);
    expect(listed.vaults[0].vaultId).toBe(created.vaultId);
    expect(listed.vaults[0].entries).toHaveLength(1);
    expect(listed.vaults[0].entries[0].cid).toBe(added.cid);
    expect(listed.vaults[0].entries[0].metadata.service).toBe("github");
    expect(listed.vaults[0].entries[0].metadata.username).toBe("alice");
    expect(listed.vaults[0].entries[0].tokenId).toBe(added.tokenId);

    const contractState = JSON.parse(fs.readFileSync(env.XVAULT_STATE_FILE, "utf8"));
    assertContractMetadataOnly(contractState, [masterPassword, entryPassword]);
    assertCidRecorded(contractState, added.cid);
    expect(JSON.stringify(redactSnapshot(contractState))).not.toContain(entryPassword);

    const ipfs = createFileBackedMockIpfs(env.XVAULT_FIXTURE_IPFS_FILE);
    const blob = ipfs.getBlob(added.cid);
    expect(blob).toBeTruthy();
    const envelope = JSON.parse(blob.toString("utf8"));
    assertEncryptedBlobEnvelope(envelope);

    const localVaults = JSON.parse(fs.readFileSync(path.join(home, "vaults.json"), "utf8"));
    const saltHex = localVaults.vaults[created.vaultId].saltHex;
    const rootKey = await deriveRootKey(masterPassword, saltHex);
    const key = await webcrypto.subtle.importKey("raw", rootKey, "AES-GCM", false, ["decrypt"]);
    const plain = await webcrypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(envelope.iv, "base64"),
        additionalData: new TextEncoder().encode("xvault:entry:v1"),
        tagLength: 128
      },
      key,
      new Uint8Array([...Buffer.from(envelope.ciphertext, "base64"), ...Buffer.from(envelope.tag, "base64")])
    );
    const decrypted = JSON.parse(Buffer.from(plain).toString("utf8"));
    expect(decrypted.service).toBe("github");
    expect(decrypted.username).toBe("alice");
    expect(decrypted.password).toBe(entryPassword);
    expect(JSON.stringify(contractState)).not.toContain(decrypted.password);

    const observation = assertEverwoodSignerListOff();
    expect(observation.network).toBe("testnet");
    expect(observation.SignerEntries).toEqual([]);
    expect(observation.everwoodSignerList).toBe("off");
  });
});
