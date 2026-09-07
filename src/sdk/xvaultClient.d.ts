import type { Client, Wallet } from "xrpl";

export interface VaultSummary {
  vaultId: string;
  owner: string;
  type?: "individual" | "team";
  manifestTokenId?: string;
}

export interface EntryPayload {
  service: string;
  username?: string;
  password?: string;
  notes?: string;
}

export interface RecoveryShare {
  shareId: string;
  share: string;
}

export interface XVaultClientConfig {
  hotpocketWsUrl: string;
  xrplClient: Client;
  wallet: Wallet;
  quicknodeConfig: {
    apiKey?: string;
    apiBase?: string;
    gateway: string;
    fetchImpl?: typeof fetch;
  };
  enableTeamMode?: boolean;
  rootKeyProvider?: (ctx: { vaultId: string; type: "individual" | "team" }) => Promise<Uint8Array>;
  getTeamAuthorizedAddresses?: (vaultId: string) => Promise<string[]>;
  getVaultSalt?: (vaultId: string) => Promise<string>;
  wsTimeoutMs?: number;
  wsFactory?: (url: string) => any;
  submitContractRequest?: (operation: { type: string; payload: object }) => Promise<any>;
  ipfsClient?: {
    uploadBlob: (data: Buffer | Blob | string, options?: object) => Promise<{ cid: string; size?: number }>;
    unpinCid?: (cid: string) => Promise<boolean>;
    getGatewayUrl: (cid: string, gatewayBase?: string) => string;
  };
}

export interface XVaultClient {
  createVault(options: {
    type: "individual" | "team";
    initialAuthorized?: string[];
    recoveryThreshold?: number;
    recoveryTotal?: number;
  }): Promise<{
    vaultId: string;
    manifestTokenId: string;
    uriTokenId?: string;
    saltHex: string;
    mintMode?: string;
    network: "testnet";
  }>;
  addEntry(vaultId: string, entryData: EntryPayload): Promise<{ tokenId: string; cid: string; network?: string }>;
  getEntry(vaultId: string, entryIndexOrTokenId: string | number): Promise<{ cid: string; gatewayUrl: string; metadata: object }>;
  listVaults(): Promise<VaultSummary[]>;
  listEntries(vaultId: string): Promise<{ vaultId: string; network: string; entries: object[] }>;
  list(options?: { vaultId?: string }): Promise<{ network: string; vaults: object[] }>;
  inviteToVault(vaultId: string, inviteeAddress: string): Promise<void>;
  acceptInvite(vaultId: string): Promise<void>;
  removeMember(vaultId: string, memberAddress: string): Promise<void>;
  revokeVault(vaultId: string): Promise<void>;
  enableRecovery(vaultId: string, threshold: number, total: number): Promise<{ shares: string[]; recoveryMetadataCid?: string }>;
  recoverVault(shares: string[], vaultId: string): Promise<boolean>;
  close(): Promise<void>;
}

export function createXVaultClient(config: XVaultClientConfig): XVaultClient;

