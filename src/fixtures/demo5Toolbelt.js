import { redactSnapshot } from "./hardGates.js";

export const DEMO5_JOB_SERVICE = "job-env";
export const DEMO5_FIXTURE_STATUS = "HOLD";
export const DEMO5_UNLOCK_SHIPPED = false;

/**
 * Agent-path metadata for a named job. Contract / list see this only —
 * env values stay inside the client-encrypted blob.
 */
export function jobEnvEntryPayload(jobId, envMap) {
  return {
    service: DEMO5_JOB_SERVICE,
    username: jobId,
    password: JSON.stringify(envMap),
    notes: "encrypted-env-blob"
  };
}

/**
 * Scored / chat-like evidence artifact. Must never include env values,
 * keys, or local-unlock plaintext.
 */
export function buildRedactedEvidenceDump({
  jobId,
  vaultId,
  cid,
  listed,
  unlock,
  observation
}) {
  const redactedList = redactSnapshot(listed);
  return {
    kind: "scored-chat-artifact",
    demo: "HG-DEMO-5-TOOLBELT",
    fixtureStatus: DEMO5_FIXTURE_STATUS,
    jobId,
    turns: [
      { role: "human", text: `Prepare encrypted env for job ${jobId}` },
      {
        role: "agent",
        text: `Wrote encrypted env blob. cid=${cid} vault=${vaultId} (ciphertext on mock IPFS; contract metadata only)`
      },
      {
        role: "agent",
        text: "Human unlock is local-only. Unlock helper did not print secrets. Ship unlock: No."
      }
    ],
    contract: {
      vaultId,
      cid,
      metadataOnly: true
    },
    list: redactedList,
    unlock: {
      shipped: DEMO5_UNLOCK_SHIPPED,
      mode: unlock?.mode ?? "local-file",
      destClass: "gitignored",
      destHint: ".xvault-unlock/",
      helper: "unlockEnvelopeToLocalFile",
      printedToStdout: unlock?.printedToStdout ?? false,
      destPathInDump: null
    },
    signerList: {
      everwoodSignerList: observation?.everwoodSignerList ?? "off",
      SignerEntries: observation?.SignerEntries ?? []
    }
  };
}
