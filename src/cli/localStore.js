import fs from "node:fs";
import path from "node:path";

export function openLocalStore(homeDir) {
  const vaultsPath = path.join(homeDir, "vaults.json");

  function read() {
    if (!fs.existsSync(vaultsPath)) return { vaults: {} };
    const parsed = JSON.parse(fs.readFileSync(vaultsPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { vaults: {} };
  }

  function write(data) {
    fs.mkdirSync(homeDir, { recursive: true });
    fs.writeFileSync(vaultsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  function saveVault({ vaultId, saltHex, type }) {
    const data = read();
    data.vaults[vaultId] = { saltHex, type };
    write(data);
  }

  function getSalt(vaultId) {
    return read().vaults?.[vaultId]?.saltHex ?? null;
  }

  return {
    saveVault,
    getSalt
  };
}
