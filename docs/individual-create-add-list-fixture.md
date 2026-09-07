# Individual create-add-list fixture

This slice proves **create-vault → add-entry → list** for an individual vault as a team-runnable fixture. It does **not** deploy a production Evernode/HotPocket cluster.

## What the fixture simulates

| Layer | Fixture behavior |
|---|---|
| Client crypto | Real Argon2id + AES-256-GCM (`src/crypto/vaultCrypto.js`) |
| HotPocket contract | In-process `handleOperation` with isolated JSON state (`XVAULT_STATE_FILE`) |
| QuickNode IPFS | File-backed mock store; returns a CID; blob bytes stay off-contract |
| Xahau URI Token | Simulated mint, **network labeled `testnet`** |
| SignerList | Simulated issuer observation with empty SignerList (Everwood-off) |

## Run command

From the repo root after `npm ci`:

```bash
npm run test:fixture:individual
```

Equivalent:

```bash
npm run test:jest -- test/fixtures/individual-create-add-list.jest.test.js
```

The same Jest file is included in CI via `npm run test:jest`.

## Manual CLI (fixture class)

Use a throwaway home directory. Generate the master password in your shell; do not commit it.

```bash
export XVAULT_HOME="$(mktemp -d)"
export XVAULT_RUNTIME=fixture
export XVAULT_MASTER_PASSWORD="${XVAULT_MASTER_PASSWORD:?set a local ephemeral value}"

node bin/xvault-cli.js --fixture --json create-vault --type individual
node bin/xvault-cli.js --fixture --json add-entry --vault <vaultId> --service github --username alice --password "${ENTRY_PASSWORD:?set a local ephemeral value}"
node bin/xvault-cli.js --fixture --json list
```

`list` must show the added entry (`service=github`, same CID). The contract state file under `$XVAULT_HOME/contract-state.json` must contain CID + metadata only.

## Hard gates covered by the Jest fixture

- **HG-CRYPTO-CLIENT**: `CLIENT_CRYPTO_PROFILE` is Argon2id + AES-256-GCM; uploaded envelope decrypts with an Argon2id-derived root key.
- **HG-CONTRACT-METADATA-ONLY / HG-KILL-PLAINTEXT**: contract dump has no `encryptedBlob`, password, seed, or key material; entry secret does not appear in state.
- **HG-IPFS-CID**: mock upload CID equals the CID recorded on the contract and returned by `list`.
- **HG-XAHAU-URI-TESTNET**: `create-vault` returns `uriTokenId` / `manifestTokenId` with `network: "testnet"`.
- **HG-NO-EVERWOOD-SIGNERLIST**: simulated issuer observation has empty SignerList and `everwoodSignerList: "off"` (N/A for a pure simulated issuer; policy is explicit).
- **HG-REPO**: fixture lives in `Everwood-Technologies/xvault`.

## Fixture I/O (env class OPEN)

| Variable | Role |
|---|---|
| `XVAULT_RUNTIME=fixture` or `--fixture` | Select fixture runtime |
| `XVAULT_HOME` | Local vault salt store + ephemeral wallet file |
| `XVAULT_STATE_FILE` | Isolated contract JSON |
| `XVAULT_FIXTURE_IPFS_FILE` | Mock IPFS blob map |
| `XVAULT_MASTER_PASSWORD` | Argon2id input (never committed) |

Live `HOTPOCKET_WS_URL` / `QUICKNODE_IPFS_API_KEY` / `XRPL_SEED` are **not** required for this slice.

## Residuals (not this slice)

- Production Evernode cluster / live HotPocket WS deploy
- Live QuickNode IPFS pinning
- Live Xahau testnet submission (mint is simulated and labeled testnet)
- Team mode, Shamir recovery, revoke / URI burn
- Mainnet
- Closed production env-class credentials
