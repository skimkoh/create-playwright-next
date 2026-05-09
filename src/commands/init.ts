import { cancel, confirm, isCancel, select, spinner } from "@clack/prompts";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execa } from "execa";

export async function initCommand() {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, "package.json"))) {
    console.log(chalk.red("❌ No package.json found."));
    process.exit(1);
  }

  const installBrowsers = await confirm({
    message: "Install Playwright browsers now?",
    initialValue: true
  });

  // add cancellation step after each prompt
  if (isCancel(installBrowsers)) {
    cancel("Operation cancelled.");
    process.exit(0);
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

    if (installBrowsers) {
      await execa("npx", ["playwright", "install"], {
        stdio: "inherit"
      });
    }

    s.stop("Playwright setup complete!");

    console.log(chalk.green("\n✅ Setup complete!\n"));
    console.log("Next steps:");
    console.log(chalk.cyan("  npm run test:e2e"));
  } catch (err) {
    s.stop("Failed ❌");
    console.error(err);
  }
}

function getConfigTemplate(testDir: string) {
  return `
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './${testDir}',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true
  }
});
`;
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
