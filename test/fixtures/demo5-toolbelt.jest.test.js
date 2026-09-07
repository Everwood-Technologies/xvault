import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { Wallet } from "xrpl";
import { deriveRootKey } from "../../src/crypto/vaultCrypto.js";
import {
  assertCidRecorded,
  assertClientCryptoProfile,
  assertContractMetadataOnly,
  assertEncryptedBlobEnvelope,
  assertEverwoodSignerListOff,
  assertListMetadataOnly,
  assertNoForbiddenPlaintext,
  assertRepoIsXvault,
  assertTestnetUriMint,
  redactSnapshot
} from "../../src/fixtures/hardGates.js";
import { createFileBackedMockIpfs } from "../../src/fixtures/mockIpfs.js";
import {
  DEMO5_FIXTURE_STATUS,
  DEMO5_JOB_SERVICE,
  DEMO5_UNLOCK_SHIPPED,
  buildRedactedEvidenceDump,
  jobEnvEntryPayload
} from "../../src/fixtures/demo5Toolbelt.js";
import { defaultUnlockDir, unlockEnvelopeToLocalFile } from "../../src/fixtures/localUnlock.js";

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

function ephemeralSecret(prefix) {
  return `${prefix}${Wallet.generate().classicAddress.slice(-12)}`;
}

describe("HG-DEMO-5-TOOLBELT agent env blobs", () => {
  test("agent writes encrypted env blob, evidence stays redacted, local unlock does not leak", async () => {
    assertRepoIsXvault(repoRoot);
    const cryptoProfile = assertClientCryptoProfile();
    expect(cryptoProfile.kdf).toBe("argon2id");
    expect(cryptoProfile.aead).toBe("AES-256-GCM");
    expect(DEMO5_UNLOCK_SHIPPED).toBe(false);
    expect(DEMO5_FIXTURE_STATUS).toBe("HOLD");

    const home = fs.mkdtempSync(path.join(os.tmpdir(), "xvault-demo5-toolbelt-"));
    const masterPassword = ephemeralSecret("master-");
    const jobId = `deploy-preview-${Wallet.generate().classicAddress.slice(-6)}`;
    const jobEnv = {
      GITHUB_TOKEN: ephemeralSecret("ghp_"),
      OPENAI_API_KEY: ephemeralSecret("sk-"),
      JOB_PREIMAGE: ephemeralSecret("preimage-")
    };
    const secrets = [masterPassword, ...Object.values(jobEnv)];
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
    assertTestnetUriMint(created);

    const payload = jobEnvEntryPayload(jobId, jobEnv);
    const added = runCli(
      [
        "--fixture",
        "--json",
        "add-entry",
        "--vault",
        created.vaultId,
        "--service",
        payload.service,
        "--username",
        payload.username,
        "--password",
        payload.password,
        "--notes",
        payload.notes
      ],
      env
    );
    expect(added.service).toBe(DEMO5_JOB_SERVICE);
    expect(added.cid).toMatch(/^b[a-z2-7]{20,}$/);

    const listed = runCli(["--fixture", "--json", "list"], env);
    assertListMetadataOnly(listed, secrets);
    expect(listed.vaults[0].entries[0].metadata.service).toBe(DEMO5_JOB_SERVICE);
    expect(listed.vaults[0].entries[0].metadata.username).toBe(jobId);
    expect(listed.vaults[0].entries[0].metadata.notes).toBe("encrypted-env-blob");

    const contractState = JSON.parse(fs.readFileSync(env.XVAULT_STATE_FILE, "utf8"));
    assertContractMetadataOnly(contractState, secrets);
    assertCidRecorded(contractState, added.cid);

    const ipfs = createFileBackedMockIpfs(env.XVAULT_FIXTURE_IPFS_FILE);
    const blob = ipfs.getBlob(added.cid);
    expect(blob).toBeTruthy();
    const envelope = JSON.parse(blob.toString("utf8"));
    assertEncryptedBlobEnvelope(envelope);
    assertNoForbiddenPlaintext(envelope, secrets, "HG-DEMO-5-TOOLBELT");

    const localVaults = JSON.parse(fs.readFileSync(path.join(home, "vaults.json"), "utf8"));
    const saltHex = localVaults.vaults[created.vaultId].saltHex;
    const rootKey = await deriveRootKey(masterPassword, saltHex);

    const unlockDir = defaultUnlockDir(home);
    const destPath = path.join(unlockDir, `${jobId}.json`);
    const unlock = await unlockEnvelopeToLocalFile({
      envelope,
      rootKey,
      destPath
    });
    expect(unlock.printedToStdout).toBe(false);
    expect(unlock.shipped).toBe(false);
    expect(unlock.mode).toBe("local-file");

    const unlocked = JSON.parse(fs.readFileSync(destPath, "utf8"));
    expect(JSON.parse(unlocked.password)).toEqual(jobEnv);

    await expect(
      unlockEnvelopeToLocalFile({
        envelope,
        rootKey,
        destPath: path.join(unlockDir, "stdout-refused.json"),
        printSecrets: true
      })
    ).rejects.toThrow(/not shipped/);

    const observation = assertEverwoodSignerListOff();
    expect(observation.everwoodSignerList).toBe("off");
    expect(observation.SignerEntries).toEqual([]);

    const evidence = buildRedactedEvidenceDump({
      jobId,
      vaultId: created.vaultId,
      cid: added.cid,
      listed,
      unlock,
      observation
    });
    expect(evidence.fixtureStatus).toBe("HOLD");
    expect(evidence.unlock.shipped).toBe(false);
    expect(evidence.unlock.destPathInDump).toBeNull();
    expect(evidence.kind).toBe("scored-chat-artifact");

    const evidenceRaw = JSON.stringify(evidence);
    assertNoForbiddenPlaintext(evidenceRaw, secrets, "HG-DEMO-5-TOOLBELT");
    expect(evidenceRaw).not.toContain(destPath);
    expect(JSON.stringify(redactSnapshot(contractState))).not.toContain(jobEnv.GITHUB_TOKEN);
  });
});
