import { CONFIG } from './config.js';
import { getApiCache, setApiCache } from './store.js';
import { isBarcelonaMatch, normalizeMatches, normalizeNews, normalizeRoster, normalizeStandings } from './normalizers.js';

function yyyymmdd(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function scoreboardDateRange(now = new Date()) {
  const start = new Date(now.getTime() - 120 * 86400000);
  const end = new Date(now.getTime() + 300 * 86400000);
  return `${yyyymmdd(start)}-${yyyymmdd(end)}`;
}

async function fetchJson(url, { timeoutMs = CONFIG.timeoutMs, cacheMs = CONFIG.cacheMs } = {}) {
  const cached = getApiCache(url, cacheMs);
  if (cached) return { data: cached.data, stale: false, cached: true, error: null };
  const stale = getApiCache(url, CONFIG.staleMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    setApiCache(url, data);
    return { data, stale: false, cached: false, error: null };
  } catch (error) {
    if (stale) return { data: stale.data, stale: true, cached: true, error: error?.message || 'network error' };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function endpoint(league, path = '') {
  return `${CONFIG.espnBase}/${encodeURIComponent(league)}/${path}`;
}

async function safeEndpoint(url) {
  try { return await fetchJson(url); }
  catch (error) { return { data: null, stale: false, cached: false, error: error?.message || 'تعذر الاتصال' }; }
}

export async function getBarcelonaMatches() {
  const range = scoreboardDateRange();
  const leagues = ['esp.1', 'uefa.champions'];
  const responses = await Promise.all(leagues.map((league) => safeEndpoint(endpoint(league, `scoreboard?dates=${range}&limit=500`))));
  const all = [];
  const sourceStates = [];
  responses.forEach((response, index) => {
    sourceStates.push({ league: leagues[index], ok: Boolean(response.data), stale: response.stale, error: response.error });
    if (response.data) all.push(...normalizeMatches(response.data, leagues[index]));
  });
  const matches = all.filter(isBarcelonaMatch);
  const unique = new Map();
  matches.forEach((match) => {
    if (!unique.has(match.id)) unique.set(match.id, match);
  });
  const result = [...unique.values()].sort((a, b) => (Number.isFinite(a.dateMs) ? a.dateMs : Infinity) - (Number.isFinite(b.dateMs) ? b.dateMs : Infinity));
  return { data: result, sources: sourceStates, ok: sourceStates.some((source) => source.ok), stale: sourceStates.some((source) => source.stale), errors: sourceStates.filter((source) => !source.ok).map((source) => source.error) };
}

export async function getStandings(league = 'esp.1') {
  // ESPN soccer standings live on the /apis/v2 route; /apis/site/v2 can return an empty stub.
  const url = `https://site.api.espn.com/apis/v2/sports/soccer/${encodeURIComponent(league)}/standings`;
  const response = await safeEndpoint(url);
  return { data: response.data ? normalizeStandings(response.data, league) : [], ok: Boolean(response.data), stale: response.stale, error: response.error };
}

export async function getRoster(teamId = '83', league = 'esp.1') {
  const response = await safeEndpoint(endpoint(league, `teams/${encodeURIComponent(String(teamId))}/roster`));
  return { data: response.data ? normalizeRoster(response.data) : [], ok: Boolean(response.data), stale: response.stale, error: response.error };
}

export async function getNews(league = 'esp.1') {
  const response = await safeEndpoint(endpoint(league, 'news?limit=30'));
  return { data: response.data ? normalizeNews(response.data, league) : [], ok: Boolean(response.data), stale: response.stale, error: response.error };
}

const translationCache = new Map();
export async function translateToArabic(text) {
  const source = String(text || '').trim();
  if (!source) return { text: '', translated: false };
  if (/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s\d\p{P}]+$/u.test(source)) return { text: source, translated: true };
  const key = source.slice(0, 700);
  if (translationCache.has(key)) return translationCache.get(key);
  const url = CONFIG.translationEndpoint + encodeURIComponent(key.slice(0, 650));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Translation HTTP ${response.status}`);
    const data = await response.json();
    const translated = Array.isArray(data?.[0]) ? data[0].map((chunk) => chunk?.[0] || '').join('').trim() : '';
    const result = translated ? { text: translated, translated: true } : { text: source, translated: false };
    translationCache.set(key, result);
    return result;
  } catch {
    // Do not cache failed translations; the user can retry after connectivity returns.
    return { text: source, translated: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function getMatchDetails(matchId, league = 'esp.1') {
  if (!matchId) return { data: null, ok: false, error: 'معرّف المباراة غير متوفر' };
  const response = await safeEndpoint(endpoint(league, `summary?event=${encodeURIComponent(String(matchId))}`));
  return { data: response.data, ok: Boolean(response.data), error: response.error };
}
