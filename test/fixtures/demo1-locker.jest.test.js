import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";
import { Wallet } from "xrpl";
import {
  assertCidRecorded,
  assertClientCryptoProfile,
  assertContractMetadataOnly,
  assertEncryptedBlobEnvelope,
  assertEverwoodSignerListOff,
  assertFixtureHtmlCiphertextOnly,
  assertListMetadataOnly,
  assertNoForbiddenPlaintext,
  assertRepoIsXvault,
  assertTestnetUriMint
} from "../../src/fixtures/hardGates.js";
import { createFileBackedMockIpfs } from "../../src/fixtures/mockIpfs.js";
import {
  DEMO1_FIXTURE_HTML_PATH,
  DEMO1_UI_SURFACE,
  buildLockerViewModel,
  writeFixtureHtmlDump
} from "../../src/fixtures/demo1Locker.js";

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

describe("HG-DEMO-1-LOCKER fixture-html", () => {
  test("create + add PAT/API key + list stay ciphertext-only on fixture-html", async () => {
    assertRepoIsXvault(repoRoot);
    assertClientCryptoProfile();
    expect(fs.existsSync(DEMO1_FIXTURE_HTML_PATH)).toBe(true);
    expect(fs.readFileSync(DEMO1_FIXTURE_HTML_PATH, "utf8")).toContain(`content="${DEMO1_UI_SURFACE}"`);

    const home = fs.mkdtempSync(path.join(os.tmpdir(), "xvault-demo1-locker-"));
    const masterPassword = ephemeralSecret("master-");
    const githubPat = ephemeralSecret("ghp_");
    const apiKey = ephemeralSecret("ak_live_");
    const secrets = [masterPassword, githubPat, apiKey];
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

    const patEntry = runCli(
      [
        "--fixture",
        "--json",
        "add-entry",
        "--vault",
        created.vaultId,
        "--service",
        "github-pat",
        "--username",
        "ci-bot",
        "--password",
        githubPat
      ],
      env
    );
    const apiEntry = runCli(
      [
        "--fixture",
        "--json",
        "add-entry",
        "--vault",
        created.vaultId,
        "--service",
        "api-key",
        "--username",
        "openai",
        "--password",
        apiKey
      ],
      env
    );

    const listed = runCli(["--fixture", "--json", "list"], env);
    expect(listed.vaults).toHaveLength(1);
    expect(listed.vaults[0].entries).toHaveLength(2);
    assertListMetadataOnly(listed, secrets);

    const ipfs = createFileBackedMockIpfs(env.XVAULT_FIXTURE_IPFS_FILE);
    const envelopesByCid = {};
    for (const added of [patEntry, apiEntry]) {
      const blob = ipfs.getBlob(added.cid);
      expect(blob).toBeTruthy();
      const envelope = JSON.parse(blob.toString("utf8"));
      assertEncryptedBlobEnvelope(envelope);
      envelopesByCid[added.cid] = envelope;
    }

    const viewModel = buildLockerViewModel({ listed, envelopesByCid });
    expect(viewModel.surface).toBe(DEMO1_UI_SURFACE);
    expect(viewModel.rows).toHaveLength(2);

    const dumpDir = path.join(home, "fixture-html-dump");
    const dump = writeFixtureHtmlDump(dumpDir, viewModel);
    expect(dump.surface).toBe(DEMO1_UI_SURFACE);

    assertFixtureHtmlCiphertextOnly(dump.html, secrets);
    assertNoForbiddenPlaintext(dump.jsonDump, secrets, "HG-DEMO-1-LOCKER");
    assertNoForbiddenPlaintext(listed, secrets, "HG-DEMO-1-LOCKER");

    expect(dump.html).toContain("github-pat");
    expect(dump.html).toContain("api-key");
    expect(dump.html).toContain("AES-256-GCM");
    expect(dump.html).toContain("withheld");
    expect(dump.jsonDump.rows[0].envelope.plaintext).toBe("withheld");
    expect(dump.jsonDump.rows[0].envelope.ciphertext.length).toBeGreaterThan(16);

    const contractState = JSON.parse(fs.readFileSync(env.XVAULT_STATE_FILE, "utf8"));
    assertContractMetadataOnly(contractState, secrets);
    assertCidRecorded(contractState, patEntry.cid);
    assertCidRecorded(contractState, apiEntry.cid);

    const observation = assertEverwoodSignerListOff();
    expect(observation.everwoodSignerList).toBe("off");
  });
});
