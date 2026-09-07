import { DEFAULT_URI_ISSUER, XAHAU_URI_NETWORK } from "../contract/xrplUtils.js";

/**
 * Known Everwood-controlled addresses that must never appear on a fixture
 * SignerList. Empty until a production issuer map is published; the policy
 * is still Everwood-off via an empty SignerList.
 */
export const KNOWN_EVERWOOD_ADDRESSES = Object.freeze([]);

export const EVERWOOD_SIGNERLIST_POLICY = "off";

/**
 * Simulated Xahau testnet account observation for the URI issuer.
 * Pure fixture: no live ledger query. SignerList is empty (Everwood off).
 */
export function observeFixtureIssuerAccount(issuer = DEFAULT_URI_ISSUER) {
  return {
    network: XAHAU_URI_NETWORK,
    account: issuer,
    simulated: true,
    SignerList: null,
    SignerEntries: [],
    everwoodSignerList: EVERWOOD_SIGNERLIST_POLICY,
    note: "N/A for pure simulated issuer: no SignerList object; Everwood-off is explicit."
  };
}

export function assertNoEverwoodSignerList(observation) {
  const entries = observation?.SignerEntries ?? [];
  const listed = entries
    .map((entry) => entry?.Account ?? entry?.address ?? entry)
    .filter((value) => typeof value === "string");
  for (const address of KNOWN_EVERWOOD_ADDRESSES) {
    if (listed.includes(address)) {
      throw new Error(`HG-NO-EVERWOOD-SIGNERLIST: Everwood address present on SignerList: ${address}`);
    }
  }
  if (observation?.everwoodSignerList !== EVERWOOD_SIGNERLIST_POLICY) {
    throw new Error("HG-NO-EVERWOOD-SIGNERLIST: fixture policy must be Everwood-off.");
  }
  if (listed.length > 0) {
    throw new Error("HG-NO-EVERWOOD-SIGNERLIST: simulated issuer SignerList must be empty.");
  }
  return true;
}
