import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Named UI surface for ARTIFACT I/O lock. Not a product redesign. */
export const DEMO1_UI_SURFACE = "fixture-html";

export const DEMO1_LOCKER_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/demo1-locker"
);

export const DEMO1_FIXTURE_HTML_PATH = path.join(DEMO1_LOCKER_DIR, "fixture-html.html");

/**
 * Build the fixture-html view model: metadata + envelope markers only.
 * Plaintext PAT / API-key material is never copied into the model.
 */
export function buildLockerViewModel({ listed, envelopesByCid = {} }) {
  const rows = [];
  for (const vault of listed?.vaults ?? []) {
    for (const entry of vault.entries ?? []) {
      const envelope = envelopesByCid[entry.cid];
      rows.push({
        vaultId: vault.vaultId,
        index: entry.index,
        service: entry.metadata?.service ?? "",
        username: entry.metadata?.username ?? "",
        notes: entry.metadata?.notes ?? "",
        cid: entry.cid,
        tokenId: entry.tokenId ?? "",
        envelope: {
          v: envelope?.v ?? 1,
          alg: envelope?.alg ?? "AES-256-GCM",
          ciphertext: envelope?.ciphertext ?? "",
          iv: envelope?.iv ?? "",
          tag: envelope?.tag ?? "",
          plaintext: "withheld"
        }
      });
    }
  }
  return {
    surface: DEMO1_UI_SURFACE,
    demo: "HG-DEMO-1-LOCKER",
    title: "Dev secrets locker",
    network: listed?.network ?? "testnet",
    rows
  };
}

export function renderFixtureHtml(viewModel) {
  const rowsHtml = (viewModel.rows ?? [])
    .map(
      (row) => `      <tr>
        <td>${escapeHtml(row.service)}</td>
        <td>${escapeHtml(row.username)}</td>
        <td><code>${escapeHtml(row.cid)}</code></td>
        <td>${escapeHtml(row.envelope.alg)}</td>
        <td class="ciphertext"><code>${escapeHtml(row.envelope.ciphertext)}</code></td>
        <td><code>${escapeHtml(row.envelope.iv)}</code></td>
        <td><code>${escapeHtml(row.envelope.tag)}</code></td>
        <td class="plaintext-marker">${escapeHtml(row.envelope.plaintext)}</td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>XVault Demo 1 Locker — fixture-html</title>
  <meta name="xvault-ui-surface" content="${DEMO1_UI_SURFACE}" />
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 1.5rem; color: #111; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
    code { word-break: break-all; font-size: 0.8rem; }
    .ciphertext { max-width: 28rem; }
    .note { color: #444; }
  </style>
</head>
<body data-ui-surface="${DEMO1_UI_SURFACE}" data-demo="HG-DEMO-1-LOCKER">
  <h1>Dev secrets locker</h1>
  <p class="note">UI surface: <code>${DEMO1_UI_SURFACE}</code>. Entry list is metadata + AES-256-GCM envelope markers only. Plaintext withheld.</p>
  <p>network <code>${escapeHtml(viewModel.network)}</code> · rows ${viewModel.rows.length}</p>
  <table>
    <thead>
      <tr>
        <th>service</th>
        <th>username</th>
        <th>cid</th>
        <th>alg</th>
        <th>ciphertext</th>
        <th>iv</th>
        <th>tag</th>
        <th>plaintext</th>
      </tr>
    </thead>
    <tbody>
${rowsHtml || "      <tr><td colspan=\"8\">(no entries)</td></tr>"}
    </tbody>
  </table>
</body>
</html>
`;
}

export function writeFixtureHtmlDump(dir, viewModel) {
  fs.mkdirSync(dir, { recursive: true });
  const html = renderFixtureHtml(viewModel);
  const jsonDump = {
    surface: DEMO1_UI_SURFACE,
    demo: viewModel.demo,
    network: viewModel.network,
    rows: viewModel.rows
  };
  const htmlPath = path.join(dir, "fixture-html.html");
  const jsonPath = path.join(dir, "fixture-html.json");
  fs.writeFileSync(htmlPath, html, "utf8");
  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonDump, null, 2)}\n`, "utf8");
  return { html, jsonDump, htmlPath, jsonPath, surface: DEMO1_UI_SURFACE };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
