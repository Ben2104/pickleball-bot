import test from 'node:test';
import assert from 'node:assert/strict';
import { isDryRun } from '../functions.js';

test('isDryRun accepts 1 and true only', () => {
    assert.equal(isDryRun({ DRY_RUN: '1' }), true);
    assert.equal(isDryRun({ DRY_RUN: 'true' }), true);
    assert.equal(isDryRun({ DRY_RUN: 'TRUE' }), true);
    assert.equal(isDryRun({ DRY_RUN: '0' }), false);
    assert.equal(isDryRun({}), false);
});
