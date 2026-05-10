import { cancel, confirm, isCancel, select, spinner, text } from "@clack/prompts";
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execa } from "execa";

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
  } catch (err) {
    s.stop("Failed ❌");
    console.error(err);
  }
}

function getConfigTemplate(testDir: string) {
  const templatePath = path.join(
    __dirname,
    "../templates/playwright.config.ts"
  );

  return fs
    .readFileSync(templatePath, "utf-8")
    .replace(/\$\{testDir\}/g, testDir);
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
