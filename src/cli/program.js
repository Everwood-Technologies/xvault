import { Command } from "commander";
import { runAddEntry, runCreateVault, runList } from "./commands.js";

export function createXvaultProgram() {
  const program = new Command();
  program
    .name("xvault")
    .description("XVault CLI (individual create-vault / add-entry / list)")
    .option("--fixture", "Use local fixture runtime (mocked IPFS + in-memory contract + simulated Xahau testnet mint)")
    .option("--json", "Print machine-readable JSON on stdout");

  program
    .command("create-vault")
    .description("Create an individual vault and mint a Xahau testnet URI Token reference")
    .option("--type <type>", "Vault type", "individual")
    .action(async (opts, cmd) => {
      await runCreateVault(opts, cmd.parent.opts());
    });

  program
    .command("add-entry")
    .description("Encrypt an entry client-side, upload the blob to IPFS, and record CID + metadata on the contract")
    .requiredOption("--vault <vaultId>", "Vault id from create-vault")
    .requiredOption("--service <service>", "Service label stored as metadata")
    .option("--username <username>", "Username metadata")
    .option("--password <password>", "Entry secret (never sent to the contract)")
    .option("--notes <notes>", "Optional metadata notes")
    .action(async (opts, cmd) => {
      await runAddEntry(opts, cmd.parent.opts());
    });

  program
    .command("list")
    .description("List vaults and their entry metadata/CIDs (no plaintext)")
    .option("--vault <vaultId>", "Limit to one vault")
    .action(async (opts, cmd) => {
      await runList(opts, cmd.parent.opts());
    });

  return program;
}

export async function runCli(argv = process.argv) {
  const program = createXvaultProgram();
  program.exitOverride();
  await program.parseAsync(argv);
}
