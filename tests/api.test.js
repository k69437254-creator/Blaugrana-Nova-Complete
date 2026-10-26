import test from 'node:test';
import assert from 'node:assert/strict';
import { getStandings, scoreboardDateRange } from '../www/src/api.js';

test('scoreboard date range has valid YYYYMMDD boundaries', () => {
  const range = scoreboardDateRange(new Date('2026-10-26T12:00:00Z'));
  assert.match(range, /^\d{8}-\d{8}$/);
  const [start, end] = range.split('-');
  assert.ok(Number(start) < Number(end));
});

test('standings fetch uses ESPN soccer v2 route and normalizes provider data', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ children: [{ standings: { entries: [
      { team: { id: '83', displayName: 'FC Barcelona' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 30 }] }
    ] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await getStandings('esp.1');
    assert.match(requestedUrl, /\/apis\/v2\/sports\/soccer\/esp\.1\/standings$/);
    assert.equal(response.ok, true);
    assert.equal(response.data[0].id, '83');
    assert.equal(response.data[0].points, 30);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
