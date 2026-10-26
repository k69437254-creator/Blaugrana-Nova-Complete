const asString = (value) => (value === null || value === undefined ? '' : String(value));

export function normalizeTeam(raw = {}) {
  const logo = raw.logo || raw.logos?.[0]?.href || raw.logos?.[0]?.url || raw.logos?.[0]?.src || '';
  return {
    id: asString(raw.id),
    name: raw.displayName || raw.name || raw.fullName || raw.shortDisplayName || 'فريق غير معروف',
    shortName: raw.shortDisplayName || raw.abbreviation || raw.name || raw.displayName || '—',
    abbreviation: raw.abbreviation || '',
    logo,
    color: raw.color || '',
    alternateColor: raw.alternateColor || ''
  };
}

function getCompetition(event) {
  return event?.competitions?.[0] || event?.competition || {};
}

function getStatus(event, competition) {
  const source = event?.status || competition?.status || {};
  const type = source.type || {};
  const state = (type.state || source.state || '').toLowerCase();
  const description = type.detail || type.description || source.displayClock || type.name || '';
  let status = 'scheduled';
  if (state === 'in' || /live|in progress|half/i.test(`${state} ${description}`)) status = 'live';
  else if (state === 'post' || /final|full time|ended|finished/i.test(`${state} ${description}`)) status = 'finished';
  else if (state === 'pre' || !state) status = 'scheduled';
  const label = status === 'live' ? (source.displayClock ? `مباشرة · ${source.displayClock}` : 'مباشرة الآن') : status === 'finished' ? 'انتهت المباراة' : 'لم تبدأ';
  return { status, label, clock: source.displayClock || '' };
}

export function normalizeMatch(event = {}, league = '') {
  const competition = getCompetition(event);
  const rawTeams = competition.competitors || event.competitors || [];
  const state = getStatus(event, competition);
  const competitors = rawTeams.map((item) => ({
    ...normalizeTeam(item.team || item),
    side: item.homeAway || item.side || '',
    // ESPN may return score="0" for games that have not kicked off. Never present that as a real 0–0.
    score: state.status === 'scheduled' || item.score === null || item.score === undefined || item.score === '' ? null : Number(item.score),
    winner: Boolean(item.winner),
    records: Array.isArray(item.records) ? item.records.map((record) => record.summary || record.displayValue).filter(Boolean) : []
  }));
  const home = competitors.find((item) => item.side === 'home') || competitors[0] || normalizeTeam();
  const away = competitors.find((item) => item.side === 'away') || competitors[1] || normalizeTeam();
  const dateText = event.date || competition.date || '';
  const id = asString(event.id || competition.id || `${dateText}-${home.id}-${away.id}`);
  const seasonName = event.season?.name || event.season?.year || '';
  const leagueLabels = { 'esp.1': 'الدوري الإسباني', 'uefa.champions': 'دوري أبطال أوروبا', 'eng.1': 'الدوري الإنجليزي' };
  const leagueName = leagueLabels[league] || event.league?.name || event.competitions?.[0]?.notes?.[0]?.headline || league;
  return {
    id,
    name: event.name || event.shortName || `${home.name} - ${away.name}`,
    shortName: event.shortName || '',
    date: dateText,
    dateMs: dateText ? new Date(dateText).getTime() : NaN,
    home,
    away,
    competitors,
    status: state.status,
    statusLabel: state.label,
    clock: state.clock,
    venue: competition.venue?.fullName || competition.venue?.address?.city || '',
    league: leagueName || league || 'كرة القدم',
    leagueId: league,
    season: seasonName,
    link: event.links?.find((item) => item.rel?.includes('event'))?.href || event.links?.[0]?.href || '',
    raw: event
  };
}

export function isBarcelonaTeam(team = {}) {
  const name = `${team.name || ''} ${team.shortName || ''} ${team.abbreviation || ''}`.toLowerCase();
  return /barcelona|barça|barca|fc bar/i.test(name) || String(team.id || '') === '83';
}

export function isBarcelonaMatch(match = {}) {
  return isBarcelonaTeam(match.home || {}) || isBarcelonaTeam(match.away || {}) || /barcelona|barça|barca/i.test(match.name || '');
}

export function normalizeMatches(payload, league = '') {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.events) ? payload.events : Array.isArray(payload?.schedule) ? payload.schedule : [];
  const byId = new Map();
  for (const item of rows) {
    const sourceCompetition = item?.competitions?.[0] || item?.competition || {};
    const sourceTeams = sourceCompetition.competitors || item?.competitors || [];
    if (!Array.isArray(sourceTeams) || sourceTeams.length < 2) continue;
    const hasTwoTeams = sourceTeams.filter((candidate) => {
      const team = candidate?.team || candidate || {};
      return Boolean(team.id || team.displayName || team.name || team.shortDisplayName);
    }).length >= 2;
    if (!hasTwoTeams) continue;
    const match = normalizeMatch(item, league);
    if (!match.id || !match.home.id && match.home.name === 'فريق غير معروف' || !match.away.id && match.away.name === 'فريق غير معروف') continue;
    const key = `${match.id}`;
    if (!byId.has(key)) byId.set(key, match);
  }
  return [...byId.values()].sort((a, b) => {
    const aDate = Number.isFinite(a.dateMs) ? a.dateMs : Infinity;
    const bDate = Number.isFinite(b.dateMs) ? b.dateMs : Infinity;
    return aDate - bDate;
  });
}

function collectStandingEntries(node, output) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.entries)) {
    for (const entry of node.entries) output.push(entry);
  }
  if (Array.isArray(node.children)) node.children.forEach((child) => collectStandingEntries(child, output));
  if (node.standings && typeof node.standings === 'object') collectStandingEntries(node.standings, output);
  if (Array.isArray(node.groups)) node.groups.forEach((child) => collectStandingEntries(child, output));
}

function statValue(stats, possibleNames) {
  for (const stat of (Array.isArray(stats) ? stats : [])) {
    const key = String(stat.name || stat.abbreviation || stat.type || '').toLowerCase();
    if (possibleNames.includes(key)) return stat.displayValue ?? stat.value ?? stat.summary ?? null;
  }
  return null;
}

export function normalizeStandings(payload, league = '') {
  let entries = [];
  collectStandingEntries(payload?.standings || payload, entries);
  if (!entries.length && Array.isArray(payload?.teams)) entries = payload.teams;
  const result = [];
  const ids = new Set();
  for (const entry of entries) {
    const team = normalizeTeam(entry.team || entry);
    if (!team.id || ids.has(team.id)) continue;
    ids.add(team.id);
    const stats = entry.stats || entry.statistics || [];
    const rankValue = statValue(stats, ['rank', 'playoffseed', 'seed']);
    const rank = Number(entry.note?.rank || entry.rank || rankValue || result.length + 1);
    result.push({
      ...team,
      rank: Number.isFinite(rank) && rank > 0 ? rank : result.length + 1,
      played: statValue(stats, ['gamesplayed', 'gp', 'played', 'games']) ?? null,
      wins: statValue(stats, ['wins', 'w']) ?? null,
      draws: statValue(stats, ['ties', 'draws', 'd']) ?? null,
      losses: statValue(stats, ['losses', 'l']) ?? null,
      goalsFor: statValue(stats, ['pointsfor', 'goalsfor', 'gf']) ?? null,
      goalsAgainst: statValue(stats, ['pointsagainst', 'goalsagainst', 'ga']) ?? null,
      goalDifference: statValue(stats, ['pointdifferential', 'goaldifference', 'gd']) ?? null,
      points: statValue(stats, ['points', 'pts']) ?? null,
      league
    });
  }
  return result.sort((a, b) => Number(a.rank) - Number(b.rank));
}

function collectAthletes(node, output, position = '') {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectAthletes(item, output, position);
    return;
  }
  if (typeof node !== 'object') return;
  if (node.id && (node.fullName || node.displayName || node.firstName || node.lastName)) {
    output.push({ ...node, _position: node.position?.displayName || node.position?.name || node.position || position });
    return;
  }
  const nextPosition = node.position?.displayName || node.position?.name || node.position || position;
  if (Array.isArray(node.items)) collectAthletes(node.items, output, nextPosition);
  if (Array.isArray(node.athletes)) collectAthletes(node.athletes, output, nextPosition);
  if (Array.isArray(node.groups)) collectAthletes(node.groups, output, nextPosition);
  if (Array.isArray(node.entries)) collectAthletes(node.entries, output, nextPosition);
}

export function normalizeRoster(payload) {
  const raw = [];
  collectAthletes(payload?.athletes || payload?.roster || payload?.team?.athletes || payload, raw);
  const seen = new Set();
  return raw.map((player) => {
    const id = asString(player.id);
    const name = player.fullName || player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ') || 'لاعب';
    const headshot = player.headshot?.href || player.headshot?.url || player.photo || player.image || '';
    const age = player.age ?? null;
    const jersey = player.jersey || player.displayJersey || '';
    return { id, name, firstName: player.firstName || '', lastName: player.lastName || '', position: asString(player._position || player.position?.displayName || player.position?.name || player.position), jersey: asString(jersey), age, headshot, nationality: player.citizenship || player.nationality || '', teamId: asString(player.team?.id || '') };
  }).filter((player) => player.id && player.name && !seen.has(player.id) && seen.add(player.id));
}

export function normalizeNews(payload, league = '') {
  const articles = Array.isArray(payload?.articles) ? payload.articles : Array.isArray(payload?.news) ? payload.news : [];
  const seen = new Set();
  return articles.map((article, index) => {
    const title = article.headline || article.title || '';
    const summary = article.description || article.summary || article.shortDescription || '';
    const images = Array.isArray(article.images) ? article.images : [];
    const image = article.image?.href || article.images?.[0]?.url || images[0]?.url || images[0]?.href || '';
    const url = article.links?.web?.href || article.links?.api?.news?.href || article.link || article.url || '';
    const id = asString(article.id || url || `${title}-${index}`);
    if (!title || seen.has(id)) return null;
    seen.add(id);
    return {
      id, title, summary, image, url,
      published: article.published || article.date || article.lastModified || '',
      publishedMs: Date.parse(article.published || article.date || article.lastModified || '') || 0,
      source: article.source || article.byline || 'ESPN', league
    };
  }).filter(Boolean).sort((a, b) => b.publishedMs - a.publishedMs);
}

export function formatScore(score) {
  return score === null || score === undefined || score === '' || !Number.isFinite(Number(score)) ? '–' : String(Number(score));
}

export function formatDateTime(date, locale = 'ar-IQ') {
  const parsed = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(parsed.getTime())) return 'موعد غير متاح';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(parsed);
}

export function getMatchCategory(match, now = Date.now()) {
  if (match.status === 'live') return 'live';
  if (match.status === 'finished') return 'finished';
  if (Number.isFinite(match.dateMs) && match.dateMs < now) {
    const hasScore = match.home?.score !== null && match.home?.score !== undefined && match.away?.score !== null && match.away?.score !== undefined;
    return hasScore ? 'finished' : 'unknown';
  }
  return 'upcoming';
}
