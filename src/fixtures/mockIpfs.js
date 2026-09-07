import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/**
 * File-backed QuickNode IPFS stand-in for the individual create-add-list fixture.
 * Stores encrypted blob bytes only; never used as a contract store.
 */
export function createFileBackedMockIpfs(storeFile, gateway = "https://fixture-ipfs.invalid") {
  const store = loadStore(storeFile);

  function persist() {
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    fs.writeFileSync(storeFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  async function uploadBlob(data) {
    const bytes = normalizeBytes(data);
    const cid = mockCidFromBytes(bytes);
    store.blobs[cid] = {
      cid,
      encoding: "base64",
      bytesB64: Buffer.from(bytes).toString("base64"),
      size: bytes.length
    };
    persist();
    return { cid, size: bytes.length };
  }

  async function unpinCid(cid) {
    if (store.blobs[cid]) {
      delete store.blobs[cid];
      persist();
      return true;
    }
    return false;
  }

  function getGatewayUrl(cid, gatewayBase = gateway) {
    return `${trimSlash(gatewayBase)}/ipfs/${cid}`;
  }

  function getBlob(cid) {
    const record = store.blobs[cid];
    if (!record) return null;
    return Buffer.from(record.bytesB64, "base64");
  }

  function snapshot() {
    return {
      cids: Object.keys(store.blobs),
      sizes: Object.fromEntries(Object.entries(store.blobs).map(([cid, rec]) => [cid, rec.size]))
    };
  }

  return {
    uploadBlob,
    unpinCid,
    getGatewayUrl,
    getBlob,
    snapshot
  };
}

export function mockCidFromBytes(bytes) {
  const digest = crypto.createHash("sha256").update(bytes).digest();
  let out = "bafybei";
  for (const byte of digest) {
    out += BASE32[byte % 32];
  }
  return out;
}

function loadStore(storeFile) {
  if (!fs.existsSync(storeFile)) {
    return { blobs: {} };
  }
  const parsed = JSON.parse(fs.readFileSync(storeFile, "utf8"));
  return parsed && typeof parsed === "object" && parsed.blobs ? parsed : { blobs: {} };
}

const BASE64_LIKE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function normalizeBytes(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.length > 0 && trimmed.length % 4 === 0 && BASE64_LIKE.test(trimmed)) {
      return Buffer.from(trimmed, "base64");
    }
    return Buffer.from(data, "utf8");
  }
  throw new Error("mock IPFS upload data must be Buffer, Uint8Array, or string.");
}

function trimSlash(value) {
  return String(value).endsWith("/") ? String(value).slice(0, -1) : String(value);
}
