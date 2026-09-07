import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function loadCliConfig(argvOpts = {}, env = process.env) {
  const fixture = Boolean(argvOpts.fixture || env.XVAULT_RUNTIME === "fixture");
  const home = env.XVAULT_HOME || (fixture ? path.join(os.tmpdir(), "xvault-fixture") : path.join(os.homedir(), ".xvault"));
  const fileConfig = readJsonIfExists(path.join(home, "config.json"));

  return {
    fixture,
    json: Boolean(argvOpts.json),
    home,
    hotpocketWsUrl: firstString(env.HOTPOCKET_WS_URL, fileConfig.hotpocketWsUrl, "ws://localhost:8081"),
    xrplWsUrl: firstString(env.XRPL_WS_URL, fileConfig.xrplWsUrl, "wss://xahau-testnet.example"),
    xrplSeed: firstString(env.XRPL_SEED, fileConfig.xrplSeed, ""),
    masterPassword: firstString(env.XVAULT_MASTER_PASSWORD, ""),
    quicknode: {
      apiKey: firstString(env.QUICKNODE_IPFS_API_KEY, fileConfig.quicknode?.apiKey, ""),
      apiBase: firstString(env.QUICKNODE_IPFS_API_BASE, fileConfig.quicknode?.apiBase, "https://api.quicknode.com/ipfs/rest"),
      gateway: firstString(env.QUICKNODE_GATEWAY, fileConfig.quicknode?.gateway, "https://fixture-ipfs.invalid")
    },
    stateFile: firstString(env.XVAULT_STATE_FILE, path.join(home, "contract-state.json")),
    ipfsFile: firstString(env.XVAULT_FIXTURE_IPFS_FILE, path.join(home, "ipfs-store.json"))
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return values[values.length - 1] ?? "";
}
