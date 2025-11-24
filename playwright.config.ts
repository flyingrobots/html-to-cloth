import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: 'qa',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  webServer: {
    // Build first so a fresh checkout can run tests without manual pre-steps
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: false,
    timeout: 60_000,
  },
}

export default config
