import test from 'node:test';
import assert from 'node:assert/strict';
import { chromiumReady } from '../scripts/chromium-cache.js';

test('chromium install is skipped only when that executable exists', () => {
    const present = new Set(['/cache/chromium-1200/chrome']);
    const exists = (path) => present.has(path);
    assert.equal(chromiumReady('/cache/chromium-1200/chrome', exists), true);
    assert.equal(chromiumReady('/cache/chromium-1201/chrome', exists), false);
    assert.equal(chromiumReady('', exists), false);
});
