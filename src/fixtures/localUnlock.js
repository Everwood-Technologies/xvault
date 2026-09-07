import fs from "node:fs";
import path from "node:path";
import { decryptEntry } from "../crypto/vaultCrypto.js";

/** Default dest class for local-only unlock. Must stay gitignored. */
export const LOCAL_UNLOCK_DIRNAME = ".xvault-unlock";

export const LOCAL_UNLOCK_SHIPPED = false;

/**
 * Decrypt an envelope to a local gitignored file.
 * Never prints secret material to stdout or logs.
 *
 * @param {{
 *   envelope: {ciphertext: string, iv: string, tag: string, alg?: string},
 *   rootKey: Uint8Array,
 *   destPath: string,
 *   printSecrets?: boolean
 * }} opts
 */
export async function unlockEnvelopeToLocalFile(opts) {
  if (opts?.printSecrets) {
    throw new Error("HG-DEMO-5-TOOLBELT: stdout/log unlock is not shipped; local file only.");
  }
  if (!opts?.destPath) {
    throw new Error("HG-DEMO-5-TOOLBELT: destPath is required for local unlock.");
  }
  if (looksLikeStdout(opts.destPath)) {
    throw new Error("HG-DEMO-5-TOOLBELT: refuse unlock dest that would print secrets.");
  }

  const plain = await decryptEntry(opts.envelope, opts.rootKey);
  const destPath = path.resolve(opts.destPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, `${JSON.stringify(plain, null, 2)}\n`, { mode: 0o600 });

  return {
    destPath,
    printedToStdout: false,
    shipped: LOCAL_UNLOCK_SHIPPED,
    mode: "local-file"
  };
}

export function defaultUnlockDir(homeDir) {
  return path.join(homeDir, LOCAL_UNLOCK_DIRNAME);
}

function looksLikeStdout(destPath) {
  const normalized = String(destPath).trim().toLowerCase();
  return normalized === "-" || normalized === "/dev/stdout" || normalized === "/dev/stderr";
}
