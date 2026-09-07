#!/usr/bin/env node
import { runCli } from "../src/cli/program.js";

runCli(process.argv).catch((error) => {
  const message = error?.message ?? String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
