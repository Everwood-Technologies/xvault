# Demo 1 — Dev secrets locker (HG-DEMO-1-LOCKER)

Mike-locked acceptance demo. Extends the individual create → add → list fixture. Does **not** invent demos 2–4.

## UI surface (ARTIFACT I/O)

Named surface: **`fixture-html`**

| Path | Role |
|---|---|
| `fixtures/demo1-locker/fixture-html.html` | Committed static shell (surface name lock) |
| harness dump `fixture-html.html` / `fixture-html.json` | Filled metadata + AES-256-GCM envelope markers |

The UI shows ciphertext / envelope markers only. Plaintext PAT and API-key values are never written into HTML or the JSON dump. `list` returns metadata + CID only.

## Run

```bash
npm ci
npm run test:fixture:demo1-locker
```

Equivalent:

```bash
npm run test:jest -- test/fixtures/demo1-locker.jest.test.js
```

## What the harness does

1. `create-vault --type individual` via existing fixture CLI/SDK
2. `add-entry` for a GitHub PAT and an API key (ephemeral generated values)
3. `list` — metadata only
4. Render `fixture-html` from list + mock IPFS envelopes
5. Assert PAT / API-key plaintext is absent from HTML, JSON dump, and list output

## Status

- Fixture PASS is **HOLD** (not a production ship)
- Unlock is **not** shipped on this demo
- Team / Shamir / revoke / mainnet / prod Evernode remain out of slice
