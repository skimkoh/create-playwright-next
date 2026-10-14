// TEMPLATE FILE - IGNORE ERRORS HERE
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
    testDir: './${testDir}',
    use: {
        baseURL,
        headless: true
    },
    webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: true
    }
});