import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatScore,
  getMatchCategory,
  isBarcelonaMatch,
  normalizeMatches,
  normalizeNews,
  normalizeRoster,
  normalizeStandings
} from '../www/src/normalizers.js';

test('scoreboard normalizer keeps provider scores and team logos', () => {
  const rows = normalizeMatches({ events: [{
    id: 'match-1', name: 'Barcelona vs Valencia', date: '2026-10-25T18:00Z',
    status: { type: { state: 'post', detail: 'Final' } },
    competitions: [{ competitors: [
      { id: '83', homeAway: 'home', score: '2', winner: true, team: { id: '83', displayName: 'FC Barcelona', logo: 'https://img.example/barca.png' } },
      { id: '94', homeAway: 'away', score: '1', team: { id: '94', displayName: 'Valencia CF', logo: 'https://img.example/valencia.png' } }
    ] }]
  }] }, 'esp.1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].home.score, 2);
  assert.equal(rows[0].away.score, 1);
  assert.equal(rows[0].home.logo, 'https://img.example/barca.png');
  assert.equal(isBarcelonaMatch(rows[0]), true);
});

test('scheduled events do not expose ESPN placeholder zero scores', () => {
  const rows = normalizeMatches({ events: [{
    id: 'future', date: '2027-01-01T18:00Z', status: { type: { state: 'pre', detail: 'Scheduled' } },
    competitions: [{ competitors: [
      { homeAway: 'home', score: '0', team: { id: '83', displayName: 'FC Barcelona' } },
      { homeAway: 'away', score: '0', team: { id: '99', displayName: 'Opponent' } }
    ] }]
  }] });
  assert.equal(rows[0].home.score, null);
  assert.equal(rows[0].away.score, null);
});

test('schedule normalizer ignores malformed records and deduplicates ids', () => {
  const result = normalizeMatches({ events: [
    { id: 'same', date: '2026-10-30T18:00Z', competitions: [{ competitors: [{ homeAway: 'home', team: { id: '83', displayName: 'Barcelona' } }, { homeAway: 'away', team: { id: '1', displayName: 'Opponent' } }] }] },
    { id: 'same', date: '2026-10-30T18:00Z', competitions: [{ competitors: [{ homeAway: 'home', team: { id: '83', displayName: 'Barcelona' } }, { homeAway: 'away', team: { id: '1', displayName: 'Opponent' } }] }] },
    { id: 'bad', competitors: [] }
  ] });
  assert.equal(result.length, 1);
});

test('standings normalizer handles nested children and missing statistics', () => {
  const rows = normalizeStandings({ children: [{ standings: { entries: [
    { team: { id: '83', displayName: 'Barcelona', logos: [{ href: 'https://img.example/barca.png' }] }, stats: [
      { name: 'rank', value: 1 }, { name: 'gamesPlayed', value: 10 }, { name: 'wins', value: 8 }, { name: 'points', value: 25 }
    ] },
    { team: { id: '99', displayName: 'Club Example' }, stats: [{ name: 'rank', value: 2 }] }
  ] } }] }, 'esp.1');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].played, 10);
  assert.equal(rows[0].points, 25);
  assert.equal(rows[1].draws, null);
});

test('roster normalizer reads grouped athletes and headshots', () => {
  const players = normalizeRoster({ athletes: [{ position: { name: 'Forward' }, items: [
    { id: 'p1', fullName: 'Player One', jersey: '9', headshot: { href: 'https://img.example/p1.png' } },
    { id: 'p2', displayName: 'Player Two', position: { displayName: 'Midfielder' } }
  ] }] });
  assert.equal(players.length, 2);
  assert.equal(players[0].position, 'Forward');
  assert.equal(players[0].headshot, 'https://img.example/p1.png');
  assert.equal(players[1].name, 'Player Two');
});

test('news normalizer preserves provider links and published dates', () => {
  const rows = normalizeNews({ articles: [{
    id: 'news-1', headline: 'A real headline from provider', description: 'Summary from provider',
    published: '2026-10-25T10:00:00Z', images: [{ url: 'https://img.example/news.jpg' }],
    links: { web: { href: 'https://example.com/story' } }
  }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'A real headline from provider');
  assert.equal(rows[0].image, 'https://img.example/news.jpg');
  assert.equal(rows[0].url, 'https://example.com/story');
});

test('formatScore never converts missing scores to zero', () => {
  assert.equal(formatScore(null), '–');
  assert.equal(formatScore(undefined), '–');
  assert.equal(formatScore('3'), '3');
  assert.equal(formatScore('not a score'), '–');
});

test('match categorization respects live and finished provider states', () => {
  assert.equal(getMatchCategory({ status: 'live', dateMs: Date.now() }), 'live');
  assert.equal(getMatchCategory({ status: 'finished', dateMs: Date.now() }), 'finished');
  assert.equal(getMatchCategory({ status: 'scheduled', dateMs: Date.now() + 10000 }), 'upcoming');
  assert.equal(getMatchCategory({ status: 'scheduled', dateMs: Date.now() - 10000, home: { score: null }, away: { score: null } }), 'unknown');
});
