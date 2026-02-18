const DEFAULT_GATEWAY = "https://grandfather-as-effect.quicknode-ipfs.com/ipfs";

export function getGatewayBaseUrl() {
  const raw = process.env.QUICKNODE_GATEWAY || process.env.QUICKNODE_IPFS_GATEWAY || DEFAULT_GATEWAY;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function getQuickNodeApiKeyHint() {
  return process.env.QUICKNODE_IPFS_API_KEY ? "configured" : "not-configured";
}

export function isTeamModeEnabled() {
  return process.env.ENABLE_TEAM_MODE === "true";
}

export function isMutableUriTokensEnabled() {
  return process.env.ENABLE_MUTABLE_URITOKENS === "true";
}

