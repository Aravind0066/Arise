import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInternetStatus, onlineRequestErrorMessage, runIfOnline } from '../lib/connectivityRules.ts';

describe('internet connectivity rules', () => {
  test('distinguishes internet reachability from an active network connection', () => {
    assert.equal(normalizeInternetStatus({ isConnected: true, isInternetReachable: false }), 'offline');
    assert.equal(normalizeInternetStatus({ isConnected: false, isInternetReachable: true }), 'offline');
    assert.equal(normalizeInternetStatus({ isConnected: true, isInternetReachable: true }), 'online');
    assert.equal(normalizeInternetStatus({ isConnected: true, isInternetReachable: null }), 'unknown');
  });

  test('blocks an online action before it runs when offline', async () => {
    let requestCount = 0;
    const result = await runIfOnline(async () => 'offline', async () => {
      requestCount += 1;
      return 'requested';
    });
    assert.deepEqual(result, { started: false });
    assert.equal(requestCount, 0);
  });

  test('allows an online action and preserves its result', async () => {
    const result = await runIfOnline(async () => 'online', async () => 'response');
    assert.deepEqual(result, { started: true, value: 'response' });
  });

  test('keeps offline, backend, and AI-service errors distinct', () => {
    const aiError = Object.assign(new Error('provider unavailable'), { kind: 'ai' });
    assert.match(onlineRequestErrorMessage(new Error('fetch failed'), 'offline'), /^You are offline\./);
    assert.equal(onlineRequestErrorMessage(new Error('Request returned HTTP 404'), 'online'), 'Request returned HTTP 404');
    assert.equal(onlineRequestErrorMessage(aiError, 'online'), 'provider unavailable');
  });
});
