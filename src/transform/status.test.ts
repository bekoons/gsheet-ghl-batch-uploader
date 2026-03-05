import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGhlFailure, classifyValidationResult } from './status';

test('classifyValidationResult marks missing linkedin as skipped', () => {
  assert.equal(classifyValidationResult({ linkedinProfileUrl: '', isLinkedinValid: false }), 'SKIPPED_MISSING_LINKEDIN');
});

test('classifyValidationResult returns undefined for valid linkedin', () => {
  assert.equal(
    classifyValidationResult({ linkedinProfileUrl: 'https://www.linkedin.com/in/person', isLinkedinValid: true }),
    undefined
  );
});

test('classifyGhlFailure maps timeout', () => {
  assert.equal(classifyGhlFailure({ ok: false, kind: 'TIMEOUT', message: 'timeout' }), 'FAILED_TIMEOUT');
});

test('classifyGhlFailure maps exhausted 429 as 4xx', () => {
  assert.equal(classifyGhlFailure({ ok: false, kind: '4XX', status: 429, message: 'rate limited' }), 'FAILED_GHL_4XX');
});

test('classifyGhlFailure maps 500 as 5xx', () => {
  assert.equal(classifyGhlFailure({ ok: false, kind: '5XX', status: 500, message: 'server error' }), 'FAILED_GHL_5XX');
});

test('classifyGhlFailure maps 404 as 4xx', () => {
  assert.equal(classifyGhlFailure({ ok: false, kind: '4XX', status: 404, message: 'not found' }), 'FAILED_GHL_4XX');
});

test('classifyGhlFailure maps network to validation bucket', () => {
  assert.equal(classifyGhlFailure({ ok: false, kind: 'NETWORK', message: 'socket hang up' }), 'FAILED_VALIDATION');
});
