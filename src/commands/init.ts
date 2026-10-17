import {
  cancel,
  confirm,
  isCancel,
  password,
  select,
  spinner,
  text
} from "@clack/prompts";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execa } from "execa";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

export async function initCommand() {
  const cwd = process.cwd();

  const standaloneOrInNextProject = await select({
    message: "Is this a Next.js project or do you want to setup a standalone Playwright project?",
    options: [
      { value: "standalone", label: "Standalone Playwright Project" },
      { value: "next", label: "In Next.js project" }
    ]
  });

  // if cancelled, exit early
  if (isCancel(standaloneOrInNextProject)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }


  if (standaloneOrInNextProject === "standalone") {
    const projectFolder = await text({
      message: "What should the standalone Playwright project folder be called?",
      placeholder: "playwright-project",
      validate(value) {
        if (!value) return "Project folder name is required";
        if (value.includes(" ")) return "Folder name cannot contain spaces";
      }
    });

    // if cancelled, exit early
    if (isCancel(projectFolder)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

  }


  // for next projects
  if (standaloneOrInNextProject === "next") {
    const packageJsonPath = path.join(cwd, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.red("No package.json found."));
      process.exit(1);
    }

    const packageJson = fs.readJsonSync(packageJsonPath);

    const hasNext =
      packageJson.dependencies?.next ||
      packageJson.devDependencies?.next;

    if (!hasNext) {
      console.log(
        chalk.red("This project is not a Next.js project (next dependency not found).")
      );
      process.exit(1);
    }
  }

  const testDir = await select({
    message: "Where should tests live?",
    options: [
      { value: "e2e", label: "e2e/" },
      { value: "tests/e2e", label: "tests/e2e/" }
    ]
  });

  if (isCancel(testDir)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const s = spinner();
  s.start("Setting up Playwright...");

  try {
    await execa("npm", ["install", "-D", "@playwright/test"], {
      stdio: "inherit"
    });

    const configPath = path.join(
      cwd,
      "playwright.config.ts"
    );

    await fs.writeFile(configPath, getConfigTemplate(testDir as string));

    const workflowPath = path.join(
      cwd,
      ".github",
      "workflows",
      "playwright.yml"
    );
    if (await fs.pathExists(workflowPath)) {
      console.log(chalk.yellow("Existing .github/workflows/playwright.yml left unchanged."));
    } else {
      await fs.ensureDir(path.dirname(workflowPath));
      await fs.writeFile(workflowPath, getWorkflowTemplate());
    }

    const testFolder = path.join(cwd, testDir as string);
    await fs.ensureDir(testFolder);

    await fs.writeFile(
      path.join(testFolder, "example.spec.ts"),
      exampleTestTemplate()
    );

    const pkg = await fs.readJson(path.join(cwd, "package.json"));

    pkg.scripts = {
      ...pkg.scripts,
      "test:e2e": "playwright test",
      "test:e2e:ui": "playwright test --ui"
    };

    await fs.writeJson(path.join(cwd, "package.json"), pkg, { spaces: 2 });

    s.stop("Playwright setup complete!");

    console.log(chalk.green("\n✅ Setup complete!\n"));
    console.log("Next steps:");
    console.log(chalk.cyan("  npm run test:e2e"));
    console.log(chalk.cyan("  Add UAT_EMAIL and UAT_PASSWORD as repository secrets"));

    await configureGitHubSecrets(cwd);
  } catch (err) {
    s.stop("Failed ❌");
    console.error(err);
  }
}

function getConfigTemplate(testDir: string) {
  return fs
    .readFileSync(
      new URL("../src/templates/playwright.config.ts", import.meta.url),
      "utf-8"
    )
    .replace(/\$\{testDir\}/g, testDir);
}

function getWorkflowTemplate() {
  return fs.readFileSync(
    new URL("../src/templates/playwright.yml", import.meta.url),
    "utf-8"
  );
}

async function configureGitHubSecrets(cwd: string) {
  const shouldConfigureSecrets = await confirm({
    message: "Would you like to add UAT credentials to this GitHub repository now?"
  });

  if (isCancel(shouldConfigureSecrets) || !shouldConfigureSecrets) {
    return;
  }

  try {
    try {
      await execa("gh", ["--version"], { cwd });
    } catch {
      const installer = await getGitHubCliInstaller(cwd);

      if (!installer) {
        console.error(
          chalk.yellow("GitHub CLI is required to add repository secrets automatically. Install it from https://cli.github.com/ and run setup again.")
        );
        return;
      }

      const shouldInstall = await confirm({
        message: `GitHub CLI is missing. Install it using \`${installer.command} ${installer.args.join(" ")}\`?`
      });

      if (isCancel(shouldInstall) || !shouldInstall) {
        return;
      }

      const installResult = await execa(installer.command, installer.args, {
        cwd,
        stdio: "inherit",
        reject: false
      });

      if (installResult.exitCode !== 0) {
        console.error(
          chalk.red(`GitHub CLI installation failed. You can install it manually from https://cli.github.com/.`)
        );
        return;
      }

      try {
        await execa("gh", ["--version"], { cwd });
      } catch (err) {
        console.error(
          chalk.red("GitHub CLI installation completed, but `gh` is not available in this terminal. Restart the terminal and run setup again.")
        );
        console.error(err);
        return;
      }
    }

    let authStatus = await execa("gh", ["auth", "status"], {
      cwd,
      reject: false
    });

    if (authStatus.exitCode !== 0) {
      const shouldAuthenticate = await confirm({
        message: "GitHub is not authenticated. Sign in now using your browser?"
      });

      if (isCancel(shouldAuthenticate) || !shouldAuthenticate) {
        return;
      }

      const login = await execa(
        "gh",
        ["auth", "login", "--hostname", "github.com", "--web"],
        { cwd, stdio: "inherit", reject: false }
      );

      if (login.exitCode !== 0) {
        console.error(chalk.red("GitHub browser sign-in did not complete."));
        return;
      }

      authStatus = await execa("gh", ["auth", "status"], {
        cwd,
        reject: false
      });

      if (authStatus.exitCode !== 0) {
        console.error(chalk.red("GitHub CLI is still not authenticated."));
        return;
      }
    }

    const repositoryResult = await execa(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      { cwd }
    );
    const repository = repositoryResult.stdout.trim();

    const confirmRepository = await confirm({
      message: `Add the UAT secrets to ${repository}?`
    });

    if (isCancel(confirmRepository) || !confirmRepository) {
      return;
    }

    const email = await password({
      message: "UAT email",
      validate(value) {
        if (!value) return "UAT email is required";
      }
    });

    if (isCancel(email)) {
      return;
    }

    const uatPassword = await password({
      message: "UAT password",
      validate(value) {
        if (!value) return "UAT password is required";
      }
    });

    if (isCancel(uatPassword)) {
      return;
    }

    await execa("gh", ["secret", "set", "UAT_EMAIL", "--repo", repository], {
      cwd,
      input: email
    });
    await execa("gh", ["secret", "set", "UAT_PASSWORD", "--repo", repository], {
      cwd,
      input: uatPassword
    });

    console.log(chalk.green(`UAT secrets added to ${repository}.`));
  } catch (err) {
    console.error(
      chalk.red("Could not configure GitHub secrets. Confirm that `gh` is installed, authenticated, and has access to this repository.")
    );
    console.error(err);
  }
}

async function getGitHubCliInstaller(
  cwd: string
): Promise<{ command: string; args: string[] } | undefined> {
  if (process.platform !== "win32") return undefined;

  const configuredPath = process.env.GH_CLI_MSI_PATH;
  if (!configuredPath) return undefined;

  const installerPath = resolve(cwd, configuredPath);

  try {
    await access(installerPath);

    return {
      command: "msiexec.exe",
      args: ["/i", installerPath, "/quiet", "/norestart"]
    };
  } catch {
    return undefined;
  }
}

function exampleTestTemplate() {
  return `
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Next/);
});
`;
}
