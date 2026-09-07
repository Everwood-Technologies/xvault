import { CLIENT_CRYPTO_PROFILE } from "../crypto/vaultCrypto.js";
import { XAHAU_URI_NETWORK } from "../contract/xrplUtils.js";
import { assertNoEverwoodSignerList, observeFixtureIssuerAccount } from "./accountObservation.js";

const SENSITIVE_STATE_KEYS = new Set([
  "encryptedBlob",
  "rootKey",
  "masterPassword",
  "password",
  "secret",
  "seed",
  "privateKey",
  "preimage",
  "plaintext"
]);

export function redactSnapshot(value) {
  return JSON.parse(
    JSON.stringify(value, (key, current) => {
      if (SENSITIVE_STATE_KEYS.has(key) || key === "salt" || key === "saltHex" || key === "bytesB64") {
        return "[redacted]";
      }
      return current;
    })
  );
}

export function assertClientCryptoProfile() {
  if (CLIENT_CRYPTO_PROFILE.kdf !== "argon2id") {
    throw new Error("HG-CRYPTO-CLIENT: KDF must be Argon2id.");
  }
  if (CLIENT_CRYPTO_PROFILE.aead !== "AES-256-GCM") {
    throw new Error("HG-CRYPTO-CLIENT: AEAD must be AES-256-GCM.");
  }
  return CLIENT_CRYPTO_PROFILE;
}

export function assertEncryptedBlobEnvelope(envelope) {
  if (!envelope || envelope.alg !== "AES-256-GCM") {
    throw new Error("HG-CRYPTO-CLIENT: encrypted blob envelope is not AES-256-GCM.");
  }
  if (envelope.v !== 1 || !envelope.ciphertext || !envelope.iv || !envelope.tag) {
    throw new Error("HG-CRYPTO-CLIENT: encrypted blob envelope is incomplete.");
  }
}

export function assertContractMetadataOnly(snapshot, forbiddenPlaintext = []) {
  const raw = JSON.stringify(snapshot);
  for (const key of SENSITIVE_STATE_KEYS) {
    if (raw.includes(`"${key}"`)) {
      throw new Error(`HG-CONTRACT-METADATA-ONLY: contract state includes forbidden field ${key}.`);
    }
  }
  for (const vault of Object.values(snapshot?.vaults ?? {})) {
    for (const entry of vault.entries ?? []) {
      if (entry.encryptedBlob !== undefined) {
        throw new Error("HG-CONTRACT-METADATA-ONLY: entry persisted encryptedBlob bytes.");
      }
      if (!entry.cid) {
        throw new Error("HG-IPFS-CID: entry missing CID.");
      }
    }
  }
  for (const needle of forbiddenPlaintext) {
    if (typeof needle === "string" && needle.length > 0 && raw.includes(needle)) {
      throw new Error("HG-KILL-PLAINTEXT: contract state contains forbidden plaintext.");
    }
  }
}

export function assertCidRecorded(snapshot, cid) {
  const found = Object.values(snapshot?.vaults ?? {}).some((vault) =>
    (vault.entries ?? []).some((entry) => entry.cid === cid)
  );
  if (!found) {
    throw new Error("HG-IPFS-CID: contract state does not record the IPFS CID.");
  }
}

export function assertTestnetUriMint(createResult) {
  const tokenId = createResult?.uriTokenId ?? createResult?.manifestTokenId;
  if (!tokenId) {
    throw new Error("HG-XAHAU-URI-TESTNET: create did not yield a URI token id.");
  }
  const network = createResult?.network;
  if (network !== XAHAU_URI_NETWORK || network !== "testnet") {
    throw new Error("HG-XAHAU-URI-TESTNET: URI mint network must be labeled testnet.");
  }
  if (network === "mainnet") {
    throw new Error("HG-XAHAU-URI-TESTNET: mainnet is out of slice.");
  }
}

export function assertEverwoodSignerListOff() {
  const observation = observeFixtureIssuerAccount();
  assertNoEverwoodSignerList(observation);
  return observation;
}

export function assertRepoIsXvault(cwd = process.cwd()) {
  if (!cwd.includes("xvault") && !cwd.endsWith("workspace")) {
    throw new Error("HG-REPO: fixture must run in Everwood-Technologies/xvault.");
  }
}

export function assertNoForbiddenPlaintext(surface, forbiddenPlaintext, gate = "HG-KILL-PLAINTEXT") {
  const raw = typeof surface === "string" ? surface : JSON.stringify(surface);
  for (const needle of forbiddenPlaintext) {
    if (typeof needle === "string" && needle.length > 0 && raw.includes(needle)) {
      throw new Error(`${gate}: surface contains forbidden plaintext.`);
    }
  }
}

export function assertListMetadataOnly(listed, forbiddenPlaintext = []) {
  const raw = JSON.stringify(listed);
  for (const vault of listed?.vaults ?? []) {
    for (const entry of vault.entries ?? []) {
      if (entry.password !== undefined || entry.secret !== undefined || entry.plaintext !== undefined) {
        throw new Error("HG-CONTRACT-METADATA-ONLY: list entry includes plaintext secret fields.");
      }
      if (entry.encryptedBlob !== undefined) {
        throw new Error("HG-CONTRACT-METADATA-ONLY: list entry includes encryptedBlob bytes.");
      }
      if (!entry.cid) {
        throw new Error("HG-IPFS-CID: list entry missing CID.");
      }
      if (!entry.metadata || typeof entry.metadata !== "object") {
        throw new Error("HG-CONTRACT-METADATA-ONLY: list entry missing metadata object.");
      }
    }
  }
  assertNoForbiddenPlaintext(raw, forbiddenPlaintext, "HG-KILL-PLAINTEXT");
}

export function assertFixtureHtmlCiphertextOnly(html, forbiddenPlaintext = []) {
  if (typeof html !== "string" || html.length === 0) {
    throw new Error("HG-DEMO-1-LOCKER: fixture-html dump is empty.");
  }
  if (!html.includes('data-ui-surface="fixture-html"') && !html.includes("xvault-ui-surface")) {
    throw new Error("HG-DEMO-1-LOCKER: fixture-html surface is not named in the dump.");
  }
  if (!html.includes("AES-256-GCM") || !html.includes("ciphertext")) {
    throw new Error("HG-DEMO-1-LOCKER: fixture-html must show ciphertext / envelope markers.");
  }
  assertNoForbiddenPlaintext(html, forbiddenPlaintext, "HG-DEMO-1-LOCKER");
}
