#!/usr/bin/env node

import { Command } from "commander";
import { intro, outro } from "@clack/prompts";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";

const program = new Command();

intro(chalk.cyan("🎭 Create Playwright for Next.js"));

program
  .name("create-playwright-next")
  .description("Add Playwright to an existing Next.js app")
  .version("1.0.0");

program
  .command("init")
  .description("Setup Playwright in current project")
  .action(initCommand);

program.parse();

outro(chalk.green("Done 🚀"));
