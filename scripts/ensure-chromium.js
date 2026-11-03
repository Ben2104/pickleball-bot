import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { chromiumReady } from './chromium-cache.js';

const exe = chromium.executablePath();
if (chromiumReady(exe)) {
    console.log(`skip playwright install: ${exe}`);
    process.exit(0);
}

console.log(`playwright install chromium: missing ${exe}`);
const result = spawnSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
process.exit(result.status === 0 ? 0 : (result.status ?? 1));
