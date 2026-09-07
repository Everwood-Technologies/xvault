# Demo 5 — Agent toolbelt (HG-DEMO-5-TOOLBELT)

Mike-locked acceptance demo. Agent path writes **encrypted env blobs** for a named job. Contract records CID + metadata only.

## Run

```bash
npm ci
npm run test:fixture:demo5-toolbelt
```

Equivalent:

```bash
npm run test:jest -- test/fixtures/demo5-toolbelt.jest.test.js
```

## What the harness does

1. Create an individual vault (existing fixture runtime)
2. Agent helper `jobEnvEntryPayload` writes a job env map (`GITHUB_TOKEN`, `OPENAI_API_KEY`, …) through `add-entry`
3. Client-side Argon2id + AES-256-GCM; mock IPFS stores the ciphertext envelope; contract gets CID/metadata only
4. Build a scored chat-like evidence dump (`buildRedactedEvidenceDump`) with **no** keys/secrets
5. Exercise local unlock helper `unlockEnvelopeToLocalFile` — writes plaintext **only** to a file under `$XVAULT_HOME/.xvault-unlock/` (gitignored dest class). Never prints secrets to stdout/logs. `printSecrets` is refused.
6. Assert Everwood-off SignerList (reuse fixture observation)

## Local unlock (not shipped)

| Item | Value |
|---|---|
| Helper | `src/fixtures/localUnlock.js` → `unlockEnvelopeToLocalFile` |
| Dest class | gitignored `.xvault-unlock/` |
| Stdout | secrets never printed (default and only supported mode) |
| Ship unlock | **No** |

Fixture PASS is **HOLD**. This is not a product unlock CLI.

## Status

- Team / Shamir / revoke / mainnet / prod Evernode remain out of slice
- Prior crypto / contract metadata-only / IPFS CID / HotPocket in-process / Xahau testnet URI / kill-plaintext / Everwood-off SignerList locks stand
