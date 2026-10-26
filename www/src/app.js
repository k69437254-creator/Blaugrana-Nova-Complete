import { CONFIG } from './config.js';
import { getBarcelonaMatches, getMatchDetails, getNews, getRoster, getStandings, translateToArabic } from './api.js';
import { formatDateTime, formatScore, getMatchCategory, isBarcelonaTeam } from './normalizers.js';
import { getLocalPredictions, getSavedPosts, getSettings, readStore, saveLocalPrediction, saveSetting, toggleSavedPost } from './store.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const appRoot = $('#app-content');
const modalRoot = $('#modal-root');
const toastRoot = $('#toast-root');

const state = {
  page: 'home',
  matches: [],
  standings: [],
  roster: [],
  news: [],
  matchSources: [],
  matchOk: false,
  standingsOk: false,
  rosterOk: false,
  newsOk: false,
  stale: false,
  busy: false,
  lastUpdated: null,
  matchFilter: 'all',
  standingsLeague: 'esp.1',
  rosterLeague: 'esp.1',
  selectedTeamId: '83',
  selectedTeamName: 'برشلونة',
  rosterSearch: '',
  newsLeague: 'esp.1',
  translations: {},
  translating: new Set(),
  translatedTitles: new Set(),
  settings: getSettings(),
  predictions: getLocalPredictions(),
  savedPosts: getSavedPosts(),
  formation: '4-3-3',
  pickedPlayers: {},
  newsTranslated: new Set(),
  quizIndex: 0,
  quizScore: 0,
  quizAnswers: {},
  quizDone: false
};

const QUIZ_QUESTIONS = [
  { question: 'كم نقطة يحصل عليها الفريق عند الفوز في مباراة دوري بنظام النقاط المعتاد؟', options: ['نقطة واحدة', 'ثلاث نقاط', 'أربع نقاط', 'خمس نقاط'], answer: 1, explanation: 'الفوز يمنح الفريق ثلاث نقاط في نظام الدوري المعتاد.' },
  { question: 'كم لاعباً يبدأ به كل فريق المباراة وفق القاعدة العامة؟', options: ['9 لاعبين', '10 لاعبين', '11 لاعباً', '12 لاعباً'], answer: 2, explanation: 'يبدأ الفريق المباراة بأحد عشر لاعباً، من بينهم حارس المرمى.' },
  { question: 'من أي نقطة تُنفّذ ركلة الجزاء؟', options: ['من دائرة المنتصف', 'من نقطة الجزاء', 'من ركنية الملعب', 'من خط التماس'], answer: 1, explanation: 'تُنفّذ ركلة الجزاء من نقطة الجزاء داخل منطقة الجزاء.' },
  { question: 'ماذا تعني البطاقة الحمراء للاعب؟', options: ['إنذار فقط', 'تبديل إلزامي', 'طرد من المباراة', 'احتساب ركلة ركنية'], answer: 2, explanation: 'البطاقة الحمراء تعني طرد اللاعب من المباراة.' },
  { question: 'كم شوطاً أساسياً تتكوّن منه مباراة كرة القدم؟', options: ['شوط واحد', 'شوطان', 'ثلاثة أشواط', 'أربعة أشواط'], answer: 1, explanation: 'الوقت الأصلي يتكوّن من شوطين، عادةً مدة كل منهما 45 دقيقة قبل الوقت بدل الضائع.' }
];

const ICON_PATHS = {
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 3 3 5-3 4-3-4 3-5ZM3.5 9l5.5-1M20.5 9 15 8M5 19l4-5M19 19l-4-5M9 14h6"/>',
  table: '<path d="M4 4h16v16H4zM4 9h16M4 14h16M10 4v16M16 4v16"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 3.2a4 4 0 0 1 0 7.6M21 21v-2a4 4 0 0 0-3-3.9"/>',
  news: '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/><path d="M3 7v13a1 1 0 0 0 1 1"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a7.8 7.8 0 0 1-1.7 1l-.3 1.6h-3l-.3-1.6a7.8 7.8 0 0 1-1.7-1l-1.5.6-1.5-2.6 1.2-1a7.5 7.5 0 0 1 0-2l-1.2-1 1.5-2.6 1.5.6a7.8 7.8 0 0 1 1.7-1L12 7.4h3l.3 1.6a7.8 7.8 0 0 1 1.7 1l1.5-.6 1.5 2.6-1.2 1a7.5 7.5 0 0 1 .6 2Z"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bookmarkCheck: '<path d="M6 4h12v17l-6-4-6 4zM9 10l2 2 4-4"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
  chart: '<path d="M4 19V5M4 19h17M8 15l3-4 3 2 5-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  sparkle: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.5 8.3-8 10-4.5-1.7-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>'
};

function icon(name, size = 20) {
  return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.sparkle}</svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function safeHttpUrl(value = '') {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function initials(name = '') {
  const bits = String(name).trim().split(/\s+/).filter(Boolean);
  return (bits.length > 1 ? bits[0][0] + bits[bits.length - 1][0] : (bits[0] || '؟').slice(0, 2)).toUpperCase();
}

function teamMark(team, size = 'md') {
  const logo = safeHttpUrl(team?.logo || '');
  return `<span class="team-mark ${size}">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-team-image>` : ''}<span class="team-initials">${escapeHtml(initials(team?.name || ''))}</span></span>`;
}

function avatar(image, name, size = '') {
  const url = safeHttpUrl(image || '');
  return `<span class="player-avatar ${size}">${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-player-image>` : ''}<span>${escapeHtml(initials(name))}</span></span>`;
}

function displayTeamName(team) {
  const name = team?.name || 'فريق غير معروف';
  return /barcelona|barça|barca/i.test(name) ? 'برشلونة' : name;
}

function matchStatusLabel(match) {
  if (match.status === 'live') return 'مباشرة الآن';
  if (match.status === 'finished') return 'انتهت المباراة';
  return 'المباراة القادمة';
}

function matchScore(match) {
  const a = formatScore(match.home?.score);
  const b = formatScore(match.away?.score);
  return `<div class="scoreboard ${match.status === 'live' ? 'is-live' : ''}"><span>${a}</span><b>:</b><span>${b}</span></div>`;
}

function matchCard(match, options = {}) {
  const category = getMatchCategory(match);
  const live = category === 'live';
  const ended = category === 'finished';
  const unknown = category === 'unknown';
  const showDetail = options.detail !== false;
  const scoreReady = match.home?.score !== null && match.home?.score !== undefined && match.away?.score !== null && match.away?.score !== undefined;
  return `<article class="match-card ${live ? 'live-card' : ''}" data-match-card="${escapeHtml(match.id)}">
    <div class="match-meta"><span class="league-label">${escapeHtml(match.league || 'كرة القدم')}</span><span class="match-status ${live ? 'status-live' : ended ? 'status-finished' : ''}">${live ? '<i></i>' : ''}${escapeHtml(unknown ? 'حالة المباراة غير متاحة' : (match.statusLabel || matchStatusLabel(match)))}</span></div>
    <div class="match-teams">
      <div class="match-side ${match.home?.winner ? 'winner' : ''}">${teamMark(match.home)}<strong>${escapeHtml(displayTeamName(match.home))}</strong><small>${escapeHtml(match.home?.shortName || '')}</small></div>
      ${scoreReady ? matchScore(match) : `<div class="match-time">${escapeHtml(formatDateTime(match.date))}</div>`}
      <div class="match-side ${match.away?.winner ? 'winner' : ''}">${teamMark(match.away)}<strong>${escapeHtml(displayTeamName(match.away))}</strong><small>${escapeHtml(match.away?.shortName || '')}</small></div>
    </div>
    <div class="match-footer"><span>${icon('calendar', 15)} ${escapeHtml(formatDateTime(match.date))}</span>${showDetail ? `<button class="text-action" data-action="match-details" data-match-id="${escapeHtml(match.id)}" data-league="${escapeHtml(match.leagueId || 'esp.1')}">التفاصيل ${icon('chevron', 14)}</button>` : ''}</div>
  </article>`;
}

function emptyState(title, description, action = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon('ball', 30)}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p>${action}</div>`;
}

function statCard(value, label, iconName, extra = '') {
  return `<article class="stat-card"><span class="stat-icon">${icon(iconName, 19)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small>${extra ? `<em>${escapeHtml(extra)}</em>` : ''}</article>`;
}

function sectionHeading(title, hint = '', action = '') {
  return `<div class="section-heading"><div><h2>${escapeHtml(title)}</h2>${hint ? `<p>${escapeHtml(hint)}</p>` : ''}</div>${action}</div>`;
}

function findBarcaInStandings() {
  return state.standings.find((team) => isBarcelonaTeam(team)) || null;
}

function getNextMatch() {
  const now = Date.now();
  const upcoming = state.matches.filter((match) => match.status !== 'finished' && (match.status === 'live' || !Number.isFinite(match.dateMs) || match.dateMs >= now));
  return upcoming.find((match) => match.status === 'live') || upcoming.sort((a, b) => (a.dateMs || Infinity) - (b.dateMs || Infinity))[0] || null;
}

function getRecentResults(limit = 3) {
  return state.matches.filter((match) => getMatchCategory(match) === 'finished' && Number.isFinite(match.dateMs) && match.dateMs <= Date.now()).sort((a, b) => b.dateMs - a.dateMs).slice(0, limit);
}

function newsCard(item, compact = false) {
  const saved = state.savedPosts.some((post) => String(post.id) === String(item.id));
  const translation = state.translations[item.id] || {};
  const title = translation.title || item.title;
  const summary = translation.summary || item.summary;
  const image = safeHttpUrl(item.image);
  const articleUrl = safeHttpUrl(item.url);
  return `<article class="news-card ${compact ? 'news-compact' : ''}">
    ${image && !compact ? `<a class="news-image" href="${articleUrl || '#'}" ${articleUrl ? 'target="_blank" rel="noopener noreferrer"' : ''}><img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-news-image><span>${escapeHtml(item.source || 'ESPN')}</span></a>` : ''}
    <div class="news-copy"><div class="news-meta"><span>${escapeHtml(item.source || 'ESPN')}</span><span>${escapeHtml(item.published ? formatRelative(item.published) : 'خبر رياضي')}</span>${translation.title ? '<b class="translated-tag">عربي</b>' : ''}</div>
      <h3>${escapeHtml(title)}</h3>${summary ? `<p>${escapeHtml(summary.length > (compact ? 100 : 220) ? `${summary.slice(0, compact ? 100 : 220)}…` : summary)}</p>` : '<p class="muted-copy">لم يوفّر المصدر ملخصاً لهذا الخبر.</p>'}
      <div class="news-actions"><button class="text-action" data-action="translate-news" data-news-id="${escapeHtml(item.id)}">${translation.summary || translation.title ? 'تحديث الترجمة' : 'ترجمة إلى العربية'} ${icon('sparkle', 14)}</button><button class="save-button ${saved ? 'saved' : ''}" data-action="save-news" data-news-id="${escapeHtml(item.id)}" aria-label="${saved ? 'إزالة من المحفوظات' : 'حفظ الخبر'}">${icon(saved ? 'bookmarkCheck' : 'bookmark', 17)}</button>${articleUrl ? `<a class="text-action" href="${escapeHtml(articleUrl)}" target="_blank" rel="noopener noreferrer">المصدر ${icon('external', 14)}</a>` : ''}</div>
    </div>
  </article>`;
}

function formatRelative(dateString) {
  const time = Date.parse(dateString);
  if (!Number.isFinite(time)) return 'تاريخ غير متاح';
  const difference = Date.now() - time;
  const mins = Math.floor(Math.abs(difference) / 60000);
  if (mins < 60) return difference >= 0 ? `قبل ${Math.max(1, mins)} دقيقة` : 'قريباً';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return difference >= 0 ? `قبل ${hours} ساعة` : 'خلال ساعات';
  return formatDateTime(dateString).split('،').slice(0, 2).join('،');
}

function homeView() {
  const next = getNextMatch();
  const recent = getRecentResults(3);
  const news = state.news.slice(0, 3);
  const barcaStanding = findBarcaInStandings();
  const liveCount = state.matches.filter((match) => match.status === 'live').length;
  const upcomingCount = state.matches.filter((match) => getMatchCategory(match) === 'upcoming').length;
  const heroMatch = next ? `<div class="hero-match">
      <div class="hero-top"><span class="eyebrow">${icon('calendar', 15)} ${next.status === 'live' ? 'الحدث الآن' : 'الموعد القادم'}</span><span class="match-status ${next.status === 'live' ? 'status-live' : ''}">${next.status === 'live' ? '<i></i> مباشر' : escapeHtml(next.league || 'مباراة برشلونة')}</span></div>
      <div class="hero-teams"><div class="hero-team">${teamMark(next.home, 'lg')}<strong>${escapeHtml(displayTeamName(next.home))}</strong><small>${escapeHtml(next.home?.shortName || '')}</small></div>${next.home?.score != null && next.away?.score != null ? matchScore(next) : `<div class="hero-vs">VS<span>${escapeHtml(formatDateTime(next.date))}</span></div>`}<div class="hero-team">${teamMark(next.away, 'lg')}<strong>${escapeHtml(displayTeamName(next.away))}</strong><small>${escapeHtml(next.away?.shortName || '')}</small></div></div>
      <div class="hero-bottom"><span>${icon('pin', 15)} ${escapeHtml(next.venue || 'ملعب غير محدد')}</span><button class="button button-light" data-action="match-details" data-match-id="${escapeHtml(next.id)}" data-league="${escapeHtml(next.leagueId || 'esp.1')}">تفاصيل المباراة ${icon('arrow', 15)}</button></div>
    </div>` : `<div class="hero-match no-match"><div class="hero-top"><span class="eyebrow">${icon('calendar', 15)} جدول برشلونة</span><span class="source-chip">بيانات خارجية</span></div><h3>${state.matchOk ? 'لا توجد مباراة متاحة في نافذة البيانات الحالية' : 'لم نتمكن من جلب جدول المباريات الآن'}</h3><p>${state.matchOk ? 'قد لا يكون المصدر قد أعلن المواعيد التالية بعد. حدّث البيانات لاحقاً.' : 'لم نضع نتائج أو مواعيد تجريبية؛ جرّب التحديث عند توفر الاتصال.'}</p><button class="button button-light" data-action="refresh">إعادة المحاولة ${icon('refresh', 15)}</button></div>`;
  const stats = `<div class="stats-grid">${statCard(String(upcomingCount), 'مباريات قادمة', 'calendar')}${statCard(String(liveCount), 'مباريات مباشرة', 'ball')}${statCard(barcaStanding?.rank ? `#${barcaStanding.rank}` : '—', 'مركز برشلونة', 'trophy')}${statCard(String(state.news.length), 'أخبار من المصدر', 'news')}</div>`;
  return `<section class="welcome-row"><div><p class="eyebrow">عالم برشلونة اليوم</p><h1>أهلاً بك في <span>Blaugrana</span></h1><p>كل ما يخص البلوغرانا، من بيانات مصادر رياضية مباشرة.</p></div><button class="icon-button settings-trigger" data-action="settings" aria-label="الإعدادات">${icon('settings')}</button></section>
    ${heroMatch}${stats}
    <section class="section-block">${sectionHeading('آخر النتائج', 'مباريات انتهت بالفعل', `<button class="text-action" data-nav="matches">كل المباريات ${icon('chevron', 14)}</button>`)}${recent.length ? `<div class="match-stack">${recent.map((match) => matchCard(match, { detail: true })).join('')}</div>` : emptyState('لا توجد نتائج أخيرة متاحة', state.matchOk ? 'لم يرجع المصدر مباريات مكتملة ضمن البيانات الحالية.' : 'عند عودة الاتصال ستظهر النتائج الفعلية هنا.')}</section>
    <section class="section-block">${sectionHeading('أحدث الأخبار', 'العناوين من المصدر، والترجمة الآلية عند التوفر', `<button class="text-action" data-nav="news">كل الأخبار ${icon('chevron', 14)}</button>`)}${news.length ? `<div class="news-grid">${news.map((item) => newsCard(item, true)).join('')}</div>` : emptyState('الأخبار غير متاحة حالياً', 'لم يصلنا محتوى إخباري من مزوّد البيانات. لا نعرض أخباراً مختلقة.')}</section>
    <div class="footnote">${state.lastUpdated ? `آخر تحديث: ${escapeHtml(new Intl.DateTimeFormat('ar-IQ', { hour: 'numeric', minute: '2-digit' }).format(state.lastUpdated))}` : 'بانتظار أول تحديث'} · البيانات والصور الخارجية قد تتأثر بتغطية المصدر.</div>`;
}

function matchesView() {
  const filters = [ ['all', 'الكل'], ['upcoming', 'قادمة'], ['live', 'مباشرة'], ['finished', 'منتهية'] ];
  let matches = state.matches.slice();
  if (state.matchFilter !== 'all') matches = matches.filter((match) => getMatchCategory(match) === state.matchFilter);
  if (state.matchFilter === 'finished') matches.sort((a, b) => b.dateMs - a.dateMs);
  return `<section class="page-intro"><p class="eyebrow">MATCH CENTER</p><h1>مباريات برشلونة</h1><p>المواعيد والنتائج كما يوفّرها مزوّد البيانات، بلا نتائج مكتوبة مسبقاً.</p></section>
    <div class="filter-row">${filters.map(([value, label]) => `<button class="filter-chip ${state.matchFilter === value ? 'selected' : ''}" data-action="match-filter" data-filter="${value}">${label}${value === 'live' && state.matches.some((m) => m.status === 'live') ? '<i class="live-dot"></i>' : ''}</button>`).join('')}</div>
    ${matches.length ? `<div class="match-stack">${matches.map((match) => matchCard(match)).join('')}</div>` : emptyState(state.matchOk ? 'لا توجد مباريات ضمن هذا التصنيف' : 'تعذر تحميل المباريات', state.matchOk ? 'قد تكون البيانات لم تُحدّث بعد أو لا توجد مواعيد معلنة.' : 'تحقق من الاتصال ثم أعد المحاولة.', '<button class="button button-primary" data-action="refresh">تحديث البيانات</button>')}
    <p class="source-note">المصدر: ESPN Soccer API. تغطية المسابقات والمواعيد تعتمد على ما ينشره المصدر.</p>`;
}

function standingsView() {
  const leagues = [ ['esp.1', 'الدوري الإسباني'], ['eng.1', 'الدوري الإنجليزي'], ['uefa.champions', 'دوري الأبطال'] ];
  const rows = state.standings;
  const heading = `<div class="page-intro"><p class="eyebrow">TABLE & FORM</p><h1>جدول الترتيب</h1><p>مراكز وأرقام يوفّرها المصدر فقط، دون استكمال القيم الناقصة بالتخمين.</p></div><div class="league-tabs">${leagues.map(([id, label]) => `<button class="league-tab ${state.standingsLeague === id ? 'selected' : ''}" data-action="standings-league" data-league="${id}">${label}</button>`).join('')}</div>`;
  if (!rows.length) return `${heading}${emptyState(state.standingsOk ? 'لا توجد بيانات ترتيب' : 'الترتيب غير متاح الآن', state.standingsOk ? 'لم يرجع المصدر صفوف ترتيب قابلة للعرض.' : 'قد تكون خدمة الترتيب غير متاحة مؤقتاً.', '<button class="button button-primary" data-action="refresh">إعادة المحاولة</button>')}`;
  const table = `<div class="table-wrap"><table class="standings-table"><thead><tr><th>#</th><th>النادي</th><th>لعب</th><th>ف</th><th>ت</th><th>خ</th><th>له</th><th>عليه</th><th>نقاط</th></tr></thead><tbody>${rows.map((team) => `<tr class="${isBarcelonaTeam(team) ? 'barca-row' : ''}" data-action="select-team" data-team-id="${escapeHtml(team.id)}" data-team-name="${escapeHtml(team.name)}" tabindex="0"><td><span class="rank-number">${escapeHtml(team.rank)}</span></td><td><span class="club-cell">${teamMark(team, 'sm')}<strong>${escapeHtml(displayTeamName(team))}</strong></span></td><td>${escapeHtml(team.played ?? '—')}</td><td>${escapeHtml(team.wins ?? '—')}</td><td>${escapeHtml(team.draws ?? '—')}</td><td>${escapeHtml(team.losses ?? '—')}</td><td>${escapeHtml(team.goalsFor ?? '—')}</td><td>${escapeHtml(team.goalsAgainst ?? '—')}</td><td><strong>${escapeHtml(team.points ?? '—')}</strong></td></tr>`).join('')}</tbody></table></div><p class="source-note">اضغط على اسم أي نادٍ لفتح قائمة لاعبيه إذا كانت متاحة في المصدر.</p>`;
  return `${heading}${table}`;
}

function squadView() {
  const teams = state.standings.slice().sort((a, b) => a.name.localeCompare(b.name));
  const teamOptions = teams.map((team) => `<option value="${escapeHtml(team.id)}" data-name="${escapeHtml(team.name)}" ${String(team.id) === String(state.selectedTeamId) ? 'selected' : ''}>${escapeHtml(displayTeamName(team))}</option>`).join('');
  const filtered = state.roster.filter((player) => `${player.name} ${player.position} ${player.jersey}`.toLowerCase().includes(state.rosterSearch.toLowerCase()));
  const positions = new Map();
  state.roster.forEach((player) => positions.set(player.position || 'غير محدد', (positions.get(player.position || 'غير محدد') || 0) + 1));
  return `<section class="page-intro"><p class="eyebrow">SQUAD DIRECTORY</p><h1>دليل اللاعبين والأندية</h1><p>الصور تُحمّل من روابط يعيدها المصدر؛ لا تُستبدل بصور أشخاص تجريبية.</p></section>
    <div class="team-picker panel"><label for="team-selector">اختيار النادي</label><select id="team-selector"><option value="83" ${state.selectedTeamId === '83' ? 'selected' : ''}>برشلونة</option>${teamOptions.filter((html) => !html.includes('value="83"')).join('')}</select><span class="picker-note">${icon('users', 16)} ${state.roster.length} لاعباً أعادهم المصدر</span></div>
    <div class="roster-toolbar"><div class="search-box">${icon('search', 18)}<input id="player-search" type="search" placeholder="ابحث عن لاعب أو مركز…" value="${escapeHtml(state.rosterSearch)}" autocomplete="off"></div><span class="result-count">${filtered.length} نتيجة</span></div>
    ${state.roster.length ? `<div class="player-grid">${filtered.map((player) => `<article class="player-card">${avatar(player.headshot, player.name)}<div class="player-info"><h3>${escapeHtml(player.name)}</h3><p>${escapeHtml(player.position || 'المركز غير متاح')}</p><div class="player-meta">${player.jersey ? `<span>#${escapeHtml(player.jersey)}</span>` : ''}${player.age ? `<span>${escapeHtml(player.age)} سنة</span>` : ''}${player.nationality ? `<span>${escapeHtml(player.nationality)}</span>` : ''}</div></div><button class="player-more" data-action="player-details" data-player-id="${escapeHtml(player.id)}" aria-label="تفاصيل اللاعب">${icon('chevron', 17)}</button></article>`).join('')}</div>${!filtered.length ? emptyState('لا توجد نتائج للبحث', 'جرّب كتابة جزء من الاسم أو امسح البحث.') : ''}` : emptyState(state.rosterOk ? 'قائمة اللاعبين غير متاحة لهذا النادي' : 'تعذر تحميل قائمة اللاعبين', 'القوائم والصور تعتمد على تغطية ESPN لهذا النادي. لا نعرض أسماء أو صوراً مصطنعة.', '<button class="button button-primary" data-action="refresh-roster">إعادة المحاولة</button>')}
    ${positions.size ? `<div class="position-summary panel"><h3>توزيع المراكز بحسب المصدر</h3><div>${[...positions].map(([position, count]) => `<span>${escapeHtml(position)} <b>${count}</b></span>`).join('')}</div></div>` : ''}`;
}

function newsView() {
  const leagues = [ ['esp.1', 'إسبانيا'], ['uefa.champions', 'أوروبا'], ['eng.1', 'إنجلترا'] ];
  return `<section class="page-intro"><p class="eyebrow">NEWSROOM</p><h1>أخبار برشلونة والكرة</h1><p>العناوين والروابط من مزوّد الأخبار. نحاول ترجمة النصوص إلى العربية آلياً عند التوفر.</p></section>
    <div class="league-tabs">${leagues.map(([id, label]) => `<button class="league-tab ${state.newsLeague === id ? 'selected' : ''}" data-action="news-league" data-league="${id}">${label}</button>`).join('')}</div>
    <div class="translation-note">${icon('sparkle', 16)} الترجمة آلية وليست مراجعة تحريرية؛ عند تعذّرها يظهر النص الأصلي بوضوح.</div>
    ${state.news.length ? `<div class="news-list">${state.news.map((item) => newsCard(item)).join('')}</div>` : emptyState(state.newsOk ? 'لا توجد أخبار متاحة' : 'تعذر تحميل الأخبار', 'لا نملأ هذه الصفحة بمقالات وهمية. أعد المحاولة عند توفر المصدر.', '<button class="button button-primary" data-action="refresh">تحديث الأخبار</button>')}`;
}

function moreView() {
  const saved = state.savedPosts;
  const predictionCount = Object.keys(state.predictions).length;
  return `<section class="page-intro"><p class="eyebrow">FAN ZONE</p><h1>مساحة المشجع</h1><p>أدوات محلية تحفظ اختياراتك على هذا الجهاز؛ لا تُرسل توقعاتك لأي جهة.</p></section>
    <div class="tools-grid"><button class="tool-card" data-action="open-predictions"><span>${icon('chart', 24)}</span><strong>توقعات المباريات</strong><small>${predictionCount} اختيار محفوظ</small></button><button class="tool-card" data-action="open-lineup"><span>${icon('users', 24)}</span><strong>مصمم التشكيلة</strong><small>اختر تشكيلتك من اللاعبين المتاحين</small></button><button class="tool-card" data-action="open-analysis"><span>${icon('trophy', 24)}</span><strong>تحليل النتائج</strong><small>ملخص محسوب من آخر النتائج الفعلية</small></button><button class="tool-card" data-action="open-quiz"><span>${icon('star', 24)}</span><strong>اختبار معلومات كروية</strong><small>أسئلة عامة وقواعد كرة القدم</small></button><button class="tool-card" data-action="open-alerts"><span>${icon('bell', 24)}</span><strong>مركز التنبيهات</strong><small>المباريات المباشرة وآخر الأخبار</small></button><button class="tool-card" data-action="open-saved"><span>${icon('bookmark', 24)}</span><strong>الأخبار المحفوظة</strong><small>${saved.length} خبر محفوظ</small></button><button class="tool-card" data-action="settings"><span>${icon('settings', 24)}</span><strong>الإعدادات</strong><small>المظهر وتجربة الاستخدام</small></button></div>
    <div class="disclaimer-panel">${icon('shield', 22)}<div><strong>مصادر البيانات والشفافية</strong><p>تعتمد نتائج المباريات والترتيب والصور على خدمات خارجية عامة. قد تختلف التغطية أو تتوقف الخدمة. لا نعرض إحصاءات غير متوفرة ولا نضمن بقاء واجهات المصدر دون تغيير.</p></div></div>
    <div class="about-panel"><span class="brand-mark mini"><span></span><span></span><b>B</b></span><div><strong>Blaugrana Nova</strong><p>نسخة عربية مستقلة لمتابعة برشلونة · بيانات خارجية · إعدادات وتوقعات محلية</p></div><button class="text-action" data-action="show-sources">المصادر ${icon('external', 14)}</button></div>`;
}

function analysisView() {
  const results = state.matches.filter((match) => match.status === 'finished' && Number.isFinite(match.home?.score) && Number.isFinite(match.away?.score) && isBarcelonaMatch(match)).sort((a, b) => b.dateMs - a.dateMs).slice(0, 5);
  if (!results.length) return `<section class="page-intro"><p class="eyebrow">FORM ANALYSIS</p><h1>تحليل النتائج</h1><p>تلخيص رياضي مبني فقط على النتائج النهائية التي أعادها المصدر.</p></section>${emptyState('لا تتوفر نتائج مكتملة للتحليل', 'لن نحسب انتصارات أو أهدافاً من مباريات لم تنتهِ أو من بيانات ناقصة.', '<button class="button button-primary" data-action="refresh">تحديث البيانات</button>')}`;
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  const rows = results.map((match) => {
    const barcaHome = isBarcelonaTeam(match.home);
    const homeScore = Number(match.home.score), awayScore = Number(match.away.score);
    const scored = barcaHome ? homeScore : awayScore;
    const conceded = barcaHome ? awayScore : homeScore;
    goalsFor += scored; goalsAgainst += conceded;
    const result = scored > conceded ? 'فوز' : scored < conceded ? 'خسارة' : 'تعادل';
    if (result === 'فوز') wins += 1; else if (result === 'تعادل') draws += 1; else losses += 1;
    return `<article class="analysis-result"><div class="analysis-result-meta"><span>${escapeHtml(match.league)}</span><small>${escapeHtml(formatDateTime(match.date))}</small></div><div class="analysis-result-main"><strong>${escapeHtml(displayTeamName(match.home))}</strong><b>${formatScore(homeScore)} : ${formatScore(awayScore)}</b><strong>${escapeHtml(displayTeamName(match.away))}</strong></div><div class="analysis-result-footer"><span class="result-pill ${result === 'فوز' ? 'result-win' : result === 'خسارة' ? 'result-loss' : 'result-draw'}">${result}</span><span>برشلونة ${scored} — ${conceded}</span></div></article>`;
  });
  return `<section class="page-intro"><p class="eyebrow">FORM ANALYSIS</p><h1>تحليل النتائج</h1><p>آخر ${results.length} مباريات مكتملة أُعيدت من المصدر. الأرقام التالية محسوبة منها فقط.</p></section><div class="analysis-stats">${statCard(String(wins), 'انتصارات', 'trophy')}${statCard(String(draws), 'تعادلات', 'chart')}${statCard(String(losses), 'خسائر', 'ball')}${statCard(`${goalsFor}–${goalsAgainst}`, 'الأهداف له / عليه', 'chart')}</div><div class="analysis-results">${rows.join('')}</div><p class="source-note">إذا لم تتوفر خمس مباريات مكتملة، يعرض التطبيق العدد المتاح فقط ولا يستكمل بيانات ناقصة.</p>`;
}

function quizView() {
  if (state.quizDone) return `<section class="page-intro"><p class="eyebrow">FOOTBALL QUIZ</p><h1>أحسنت، انتهى الاختبار!</h1><p>نتيجتك من الأسئلة العامة في قواعد كرة القدم.</p></section><div class="quiz-score-card"><span>${icon('trophy', 34)}</span><strong>${state.quizScore} / ${QUIZ_QUESTIONS.length}</strong><p>${state.quizScore === QUIZ_QUESTIONS.length ? 'إجابة ممتازة! كل الإجابات صحيحة.' : state.quizScore >= 3 ? 'نتيجة جميلة، واصل متابعة تفاصيل اللعبة.' : 'جرّب مرة ثانية وثبّت معلوماتك.'}</p><button class="button button-primary" data-action="quiz-restart">إعادة الاختبار</button></div>`;
  const question = QUIZ_QUESTIONS[state.quizIndex];
  const answer = state.quizAnswers[state.quizIndex];
  return `<section class="page-intro"><p class="eyebrow">FOOTBALL QUIZ</p><h1>اختبر معلوماتك الكروية</h1><p>أسئلة عامة عن قواعد اللعبة، لا تعتمد على أسماء لاعبين أو نتائج قديمة.</p></section><div class="quiz-progress"><span>السؤال ${state.quizIndex + 1} من ${QUIZ_QUESTIONS.length}</span><div><i style="width:${((state.quizIndex + 1) / QUIZ_QUESTIONS.length) * 100}%"></i></div><b>النقاط: ${state.quizScore}</b></div><article class="quiz-card"><span class="quiz-number">${String(state.quizIndex + 1).padStart(2, '0')}</span><h2>${escapeHtml(question.question)}</h2><div class="quiz-options">${question.options.map((option, index) => `<button class="quiz-option ${answer !== undefined && index === question.answer ? 'correct' : ''} ${answer === index && answer !== question.answer ? 'incorrect' : ''}" data-action="quiz-answer" data-answer-index="${index}" ${answer !== undefined ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div>${answer !== undefined ? `<div class="quiz-feedback ${answer === question.answer ? 'is-correct' : 'is-incorrect'}"><strong>${answer === question.answer ? 'إجابة صحيحة' : 'الإجابة الصحيحة: ' + question.options[question.answer]}</strong><p>${escapeHtml(question.explanation)}</p><button class="button button-primary" data-action="quiz-next">${state.quizIndex === QUIZ_QUESTIONS.length - 1 ? 'عرض النتيجة' : 'السؤال التالي'} ${icon('arrow', 15)}</button></div>` : ''}</article>`;
}

function alertsView() {
  const liveMatches = state.matches.filter((match) => match.status === 'live');
  const alerts = state.news.slice(0, 5);
  return `<section class="page-intro"><p class="eyebrow">ALERT CENTER</p><h1>مركز التنبيهات</h1><p>ملخص داخل التطبيق من البيانات الحالية؛ لا يرسل هذا الإصدار إشعارات خلفية عندما يكون التطبيق مغلقاً.</p></section><div class="alert-summary panel"><div>${icon('bell', 24)}<div><strong>${liveMatches.length} مباريات مباشرة</strong><small>بحسب حالة المباريات التي أعادها المصدر</small></div></div><button class="button button-primary" data-action="refresh">التحقق الآن ${icon('refresh', 15)}</button></div><section class="section-block">${sectionHeading('المباريات المباشرة', 'تظهر فقط المباريات التي يصنفها المصدر على أنها مباشرة')}${liveMatches.length ? `<div class="match-stack">${liveMatches.map((match) => matchCard(match)).join('')}</div>` : emptyState('لا توجد مباراة مباشرة حالياً ضمن البيانات المستلمة', 'لا نعرض حالة مباشرة إلا إذا وردت من مزوّد البيانات.')}</section><section class="section-block">${sectionHeading('آخر الأخبار', 'أخبار حقيقية من المصدر الخارجي')}${alerts.length ? `<div class="news-list">${alerts.map((item) => newsCard(item, true)).join('')}</div>` : emptyState('لا توجد أخبار متاحة حالياً', 'قد تكون خدمة الأخبار متوقفة مؤقتاً.')}</section>`;
}

function savedView() {
  return `<section class="page-intro"><p class="eyebrow">YOUR LIBRARY</p><h1>الأخبار المحفوظة</h1><p>تُحفظ المقالات على هذا الجهاز فقط.</p></section>${state.savedPosts.length ? `<div class="news-list">${state.savedPosts.map((item) => newsCard(item)).join('')}</div>` : emptyState('لا توجد أخبار محفوظة', 'استخدم رمز الحفظ بجانب أي خبر لإضافته إلى هذه القائمة.', '<button class="button button-primary" data-nav="news">تصفّح الأخبار</button>')}`;
}

function predictionsView() {
  const upcoming = state.matches.filter((match) => getMatchCategory(match) === 'upcoming');
  const saved = state.predictions;
  const rows = Object.entries(saved);
  return `<section class="page-intro"><p class="eyebrow">YOUR PICKS</p><h1>توقعاتك الخاصة</h1><p>توقعات ترفيهية تحفظ محلياً، وليست تنبؤاً آلياً أو توصية مراهنة.</p></section>
    ${upcoming.length ? `<div class="prediction-list">${upcoming.slice(0, 12).map((match) => { const prediction = saved[match.id] || {}; return `<article class="prediction-card"><div class="prediction-title"><span>${escapeHtml(match.league)}</span><small>${escapeHtml(formatDateTime(match.date))}</small></div><div class="prediction-teams"><span>${escapeHtml(displayTeamName(match.home))}</span><span>—</span><span>${escapeHtml(displayTeamName(match.away))}</span></div><form data-prediction-form="${escapeHtml(match.id)}" class="prediction-form"><label>${escapeHtml(initials(match.home.name))}<input type="number" name="homeScore" min="0" max="99" inputmode="numeric" value="${prediction.homeScore ?? ''}" placeholder="—"></label><b>:</b><label><input type="number" name="awayScore" min="0" max="99" inputmode="numeric" value="${prediction.awayScore ?? ''}" placeholder="—">${escapeHtml(initials(match.away.name))}</label><button class="button button-primary" type="submit">حفظ التوقع</button></form></article>`; }).join('')}</div>` : emptyState('لا توجد مباريات قادمة متاحة', 'تظهر هنا التوقعات عندما يوفّر المصدر مواعيد مستقبلية.')}
    ${rows.length ? `<p class="source-note">عدد التوقعات المحفوظة: ${rows.length}. يمكن تعديلها متى ما تغيرت توقعاتك.</p>` : ''}`;
}

function lineupView() {
  const presets = [ ['4-3-3', '4–3–3'], ['4-2-3-1', '4–2–3–1'], ['3-4-3', '3–4–3'] ];
  const players = state.roster;
  const slots = state.formation === '4-2-3-1' ? ['حارس المرمى', 'ظهير أيمن', 'قلب دفاع', 'قلب دفاع', 'ظهير أيسر', 'محور', 'محور', 'جناح أيمن', 'صانع ألعاب', 'جناح أيسر', 'مهاجم'] : state.formation === '3-4-3' ? ['حارس المرمى', 'قلب دفاع', 'قلب دفاع', 'قلب دفاع', 'جناح أيمن', 'محور', 'محور', 'جناح أيسر', 'جناح أيمن', 'مهاجم', 'جناح أيسر'] : ['حارس المرمى', 'ظهير أيمن', 'قلب دفاع', 'قلب دفاع', 'ظهير أيسر', 'محور', 'وسط', 'وسط هجومي', 'جناح أيمن', 'مهاجم', 'جناح أيسر'];
  const rows = state.formation === '4-2-3-1' ? [[10], [7, 8, 9], [5, 6], [1, 2, 3, 4], [0]] : state.formation === '3-4-3' ? [[8, 9, 10], [4, 5, 6, 7], [1, 2, 3], [0]] : [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]];
  const savedLineup = state.pickedPlayers;
  const renderSlot = (index) => {
    const slot = slots[index];
    return `<label class="lineup-slot"><span>${index + 1}</span><small>${escapeHtml(slot)}</small><select data-lineup-slot="${index}"><option value="">اختر لاعباً</option>${players.map((player) => `<option value="${escapeHtml(player.id)}" ${String(savedLineup[index] || '') === String(player.id) ? 'selected' : ''}>${escapeHtml(player.name)}</option>`).join('')}</select></label>`;
  };
  return `<section class="page-intro"><p class="eyebrow">LINEUP STUDIO</p><h1>مصمم التشكيلة</h1><p>هذه أداة اختيار محلية وليست تشكيلة رسمية أو توقعاً لتشكيلة المدرب.</p></section><div class="lineup-toolbar panel"><label for="formation-select">الخطة</label><select id="formation-select">${presets.map(([value, label]) => `<option value="${value}" ${state.formation === value ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="picker-note">${players.length} لاعباً متاحاً من المصدر</span></div>
    ${players.length ? `<div class="lineup-board"><div class="pitch-line pitch-mid"></div><div class="pitch-circle"></div><div class="lineup-slots">${rows.map((row) => `<div class="lineup-row">${row.map((index) => renderSlot(index)).join('')}</div>`).join('')}</div></div><div class="lineup-actions"><button class="button button-primary" data-action="save-lineup">حفظ التشكيلة على الجهاز</button><button class="button button-quiet" data-action="clear-lineup">مسح الاختيارات</button></div>` : emptyState('قائمة اللاعبين غير متاحة', 'حمّل قائمة اللاعبين من صفحة الفريق أولاً، ثم ارجع لتصميم التشكيلة.', '<button class="button button-primary" data-nav="squad">فتح الفريق</button>')}`;
}

function settingsView() {
  return `<section class="page-intro"><p class="eyebrow">PREFERENCES</p><h1>الإعدادات</h1><p>تغييرات الواجهة تحفظ على هذا الجهاز.</p></section><div class="settings-list panel"><label class="setting-row"><span><strong>تقليل الحركة</strong><small>إيقاف حركات الواجهة غير الضرورية</small></span><input type="checkbox" id="setting-reduced-motion" ${state.settings.reducedMotion ? 'checked' : ''}></label><label class="setting-row"><span><strong>عرض مدمج</strong><small>تقليل المسافات بين البطاقات</small></span><input type="checkbox" id="setting-compact-mode" ${state.settings.compactMode ? 'checked' : ''}></label><div class="setting-row"><span><strong>لغة الواجهة</strong><small>العربية · من اليمين إلى اليسار</small></span><b>AR</b></div></div><div class="disclaimer-panel">${icon('shield', 22)}<div><strong>الخصوصية</strong><p>الإعدادات والتوقعات والتشكيلة والأخبار المحفوظة تُخزّن محلياً في التطبيق. لا يحتوي المشروع على مفاتيح سرية مضمّنة.</p></div></div><button class="button button-quiet full-width" data-action="show-sources">عرض مصادر البيانات وحدودها</button>`;
}

function sourcesModal() {
  openModal('مصادر البيانات', `<div class="source-list"><p>المباريات، النتائج، الجداول، قوائم اللاعبين والأخبار: <strong>ESPN Soccer API</strong> العامة.</p><p>ترجمة العناوين والملخصات: خدمة ترجمة عامة تُستدعى عند الطلب؛ قد لا تتوفر أو قد ترفض بعض الطلبات.</p><p>صور الأندية واللاعبين تأتي من روابط يوفّرها المصدر. إذا لم تتوفر صورة أو تعذر تحميلها، يظهر اختصار الاسم فقط.</p><p>البيانات العامة قد تتغير أو تنقص أو تتوقف، لذلك لا يضمن التطبيق التغطية الكاملة لجميع المسابقات أو صحة مصدر خارجي يتغير دون إشعار.</p><p>لا توجد نتائج أو إحصاءات أو صور أشخاص ثابتة مستخدمة كبيانات رياضية داخل التطبيق.</p></div>`);
}

function render() {
  $$('.nav-icon').forEach((element) => {
    if (!element.innerHTML) element.innerHTML = icon(element.dataset.icon || 'more', 20);
  });
  if (state.settings.compactMode) document.body.classList.add('compact-mode'); else document.body.classList.remove('compact-mode');
  if (state.settings.reducedMotion) document.body.classList.add('reduce-motion'); else document.body.classList.remove('reduce-motion');
  const secondaryPages = ['saved', 'predictions', 'lineup', 'settings', 'analysis', 'quiz', 'alerts'];
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.nav === state.page || (item.dataset.nav === 'more' && secondaryPages.includes(state.page))));
  const views = { home: homeView, matches: matchesView, standings: standingsView, squad: squadView, news: newsView, more: moreView, saved: savedView, predictions: predictionsView, lineup: lineupView, settings: settingsView, analysis: analysisView, quiz: quizView, alerts: alertsView };
  appRoot.innerHTML = (views[state.page] || homeView)();
  updateConnectionPill();
}

function updateConnectionPill() {
  const element = $('#connection-state');
  if (!element) return;
  const anyOk = state.matchOk || state.standingsOk || state.rosterOk || state.newsOk;
  element.classList.toggle('connected', anyOk && !state.stale);
  element.classList.toggle('stale', state.stale);
  element.innerHTML = `<i></i><span>${state.busy ? 'جارٍ التحديث' : state.stale ? 'بيانات محفوظة' : anyOk ? 'المصادر متاحة' : 'المصدر غير متاح'}</span>`;
}

function showToast(message, tone = '') {
  toastRoot.innerHTML = `<div class="toast ${tone ? `toast-${tone}` : ''}">${escapeHtml(message)}</div>`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toastRoot.innerHTML = ''; }, 3200);
}

function openModal(title, body, options = {}) {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-heading"><h2>${escapeHtml(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="إغلاق">${icon('close')}</button></div><div class="modal-body">${body}</div>${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}</section></div>`;
  $('.modal-card', modalRoot)?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-modal"]')) closeModal();
    event.stopPropagation();
  });
}

function closeModal() {
  modalRoot.innerHTML = '';
}

async function loadAll({ showMessage = false } = {}) {
  if (state.busy) return;
  state.busy = true;
  state.stale = false;
  updateConnectionPill();
  const results = await Promise.allSettled([getBarcelonaMatches(), getStandings(state.standingsLeague), getRoster(state.selectedTeamId, state.rosterLeague), getNews(state.newsLeague)]);
  const [matchesResult, standingsResult, rosterResult, newsResult] = results;
  if (matchesResult.status === 'fulfilled') {
    state.matches = matchesResult.value.data;
    state.matchOk = matchesResult.value.ok;
    state.matchSources = matchesResult.value.sources || [];
    state.stale = state.stale || matchesResult.value.stale;
  }
  if (standingsResult.status === 'fulfilled') {
    state.standings = standingsResult.value.data;
    state.standingsOk = standingsResult.value.ok;
    state.stale = state.stale || standingsResult.value.stale;
  }
  if (rosterResult.status === 'fulfilled') {
    state.roster = rosterResult.value.data;
    state.rosterOk = rosterResult.value.ok;
    state.stale = state.stale || rosterResult.value.stale;
  }
  if (newsResult.status === 'fulfilled') {
    state.news = newsResult.value.data;
    state.newsOk = newsResult.value.ok;
    state.stale = state.stale || newsResult.value.stale;
  }
  state.busy = false;
  state.lastUpdated = new Date();
  render();
  if (!state.matchOk && !state.standingsOk && !state.rosterOk && !state.newsOk) {
    if (showMessage) showToast('لم نتمكن من الوصول إلى مصادر البيانات. حاول مجدداً.', 'error');
  } else if (showMessage) showToast(state.stale ? 'تم عرض بيانات محفوظة؛ قد لا تكون الأحدث.' : 'تم تحديث البيانات بنجاح.', 'success');
  if (state.page === 'home') void translateVisibleTitles(3);
  if (state.page === 'news') void translateVisibleTitles(6);
}

async function reloadStandings(league) {
  state.standingsLeague = league;
  render();
  const response = await getStandings(league);
  state.standings = response.data;
  state.standingsOk = response.ok;
  state.stale = response.stale;
  state.lastUpdated = new Date();
  render();
}

async function reloadNews(league) {
  state.newsLeague = league;
  state.translations = {};
  state.translatedTitles.clear();
  state.newsTranslated.clear();
  render();
  const response = await getNews(league);
  state.news = response.data;
  state.newsOk = response.ok;
  state.stale = response.stale;
  state.lastUpdated = new Date();
  render();
  void translateVisibleTitles(6);
}

async function reloadRoster(teamId, teamName = 'برشلونة') {
  state.selectedTeamId = String(teamId || '83');
  state.selectedTeamName = teamName;
  state.rosterSearch = '';
  render();
  const response = await getRoster(state.selectedTeamId, state.rosterLeague);
  state.roster = response.data;
  state.rosterOk = response.ok;
  state.stale = response.stale;
  state.lastUpdated = new Date();
  render();
}

async function translateVisibleTitles(limit) {
  const queue = state.news.slice(0, limit).filter((item) => !state.translatedTitles.has(item.id));
  for (let index = 0; index < queue.length; index += 2) {
    const pair = queue.slice(index, index + 2);
    await Promise.all(pair.map(async (item) => {
      state.translatedTitles.add(item.id);
      const result = await translateToArabic(item.title);
      if (result.translated) state.translations[item.id] = { ...(state.translations[item.id] || {}), title: result.text };
    }));
    if (state.page === 'home' || state.page === 'news') render();
  }
}

async function translateNews(id) {
  const item = state.news.find((newsItem) => String(newsItem.id) === String(id)) || state.savedPosts.find((newsItem) => String(newsItem.id) === String(id));
  if (!item) return;
  if (state.translating.has(id)) return;
  state.translating.add(id);
  showToast('جارٍ محاولة ترجمة الخبر…');
  const [titleResult, summaryResult] = await Promise.all([translateToArabic(item.title), translateToArabic(item.summary)]);
  state.translating.delete(id);
  state.translations[id] = {
    ...(titleResult.translated ? { title: titleResult.text } : {}),
    ...(summaryResult.translated ? { summary: summaryResult.text } : {})
  };
  render();
  showToast(titleResult.translated || summaryResult.translated ? 'اكتملت الترجمة المتاحة.' : 'تعذرت الترجمة الآن؛ بقي النص الأصلي.', titleResult.translated || summaryResult.translated ? 'success' : 'error');
}

function saveNews(id) {
  const item = state.news.find((newsItem) => String(newsItem.id) === String(id)) || state.savedPosts.find((newsItem) => String(newsItem.id) === String(id));
  if (!item) return;
  state.savedPosts = toggleSavedPost(item);
  render();
  showToast(state.savedPosts.some((post) => String(post.id) === String(id)) ? 'تم حفظ الخبر على الجهاز.' : 'تمت إزالة الخبر من المحفوظات.');
}

async function showMatchDetails(id, league) {
  const match = state.matches.find((item) => String(item.id) === String(id));
  const title = match ? `${displayTeamName(match.home)} × ${displayTeamName(match.away)}` : 'تفاصيل المباراة';
  openModal(title, `<div class="loading-panel compact"><span class="loader"></span><strong>نطلب التفاصيل من المصدر</strong><p>الإحصاءات والأحداث لن تظهر إلا إذا أعادها مزوّد البيانات.</p></div>`);
  const response = await getMatchDetails(id, league);
  const data = response.data;
  if (!data) {
    openModal(title, `<div class="detail-summary">${match ? `<p><b>الموعد:</b> ${escapeHtml(formatDateTime(match.date))}</p><p><b>الحالة:</b> ${escapeHtml(match.statusLabel || 'غير متاحة')}</p><p><b>المسابقة:</b> ${escapeHtml(match.league || '')}</p>` : ''}<p class="muted-copy">لم يُرجع المصدر تقريراً تفصيلياً لهذه المباراة. قد يكون الملخص غير متاح لهذه المنافسة.</p></div>`);
    return;
  }
  const header = data.header || data.gamepackageJSON?.header || {};
  const competition = header.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const stats = data.boxscore?.teams || data.statistics?.teams || [];
  const statHtml = stats.map((team) => `<div class="detail-team-stats"><strong>${escapeHtml(team.team?.displayName || team.displayName || team.name || 'فريق')}</strong>${(team.statistics || []).slice(0, 12).map((stat) => `<div><span>${escapeHtml(stat.label || stat.name || '')}</span><b>${escapeHtml(stat.displayValue ?? stat.value ?? '—')}</b></div>`).join('')}</div>`).join('');
  const events = data.keyEvents || data.plays || data.commentary?.items || [];
  const eventHtml = Array.isArray(events) && events.length ? `<div class="event-list"><h3>أحداث المباراة</h3>${events.slice(0, 15).map((item) => `<p><b>${escapeHtml(item.clock?.displayValue || item.time?.displayValue || item.time || '')}</b> ${escapeHtml(item.text || item.shortText || item.type?.text || item.name || '')}</p>`).join('')}</div>` : '';
  const scoreHtml = competitors.length ? `<div class="detail-score">${competitors.map((team) => `<div>${teamMark({ name: team.team?.displayName || team.team?.name, logo: team.team?.logo || team.team?.logos?.[0]?.href })}<strong>${escapeHtml(team.team?.displayName || team.team?.name || 'فريق')}</strong><b>${escapeHtml(formatScore(team.score))}</b></div>`).join('')}</div>` : '';
  openModal(title, `${scoreHtml}${statHtml ? `<div class="detail-stats">${statHtml}</div>` : ''}${eventHtml}${!statHtml && !eventHtml ? '<p class="muted-copy">وصل تقرير المباراة، لكن المصدر لم يوفّر إحصاءات أو أحداث قابلة للعرض.</p>' : ''}`);
}

function openPrediction(matchId) {
  state.page = 'predictions';
  render();
  const element = $(`[data-prediction-form="${CSS.escape(String(matchId))}"]`);
  element?.scrollIntoView({ behavior: state.settings.reducedMotion ? 'auto' : 'smooth', block: 'center' });
}

function saveLineup() {
  const picks = {};
  $$('[data-lineup-slot]').forEach((select) => { if (select.value) picks[select.dataset.lineupSlot] = select.value; });
  state.pickedPlayers = picks;
  // Store using the same safe local storage layer as settings and predictions.
  saveSetting('lineup', picks);
  showToast('حُفظت اختيارات التشكيلة على الجهاز.', 'success');
}

// Restore local lineup picks saved previously.
state.pickedPlayers = readStore('settings:lineup', {}) || {};

// Event delegation keeps the app functional after re-rendering a view.
document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    event.preventDefault();
    state.page = nav.dataset.nav;
    render();
    if (state.page === 'news') void translateVisibleTitles(6);
    return;
  }
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.dataset.action;
  if (action === 'refresh') { await loadAll({ showMessage: true }); return; }
  if (action === 'match-filter') { state.matchFilter = actionElement.dataset.filter || 'all'; render(); return; }
  if (action === 'standings-league') { await reloadStandings(actionElement.dataset.league); return; }
  if (action === 'news-league') { await reloadNews(actionElement.dataset.league); return; }
  if (action === 'translate-news') { await translateNews(actionElement.dataset.newsId); return; }
  if (action === 'save-news') { saveNews(actionElement.dataset.newsId); return; }
  if (action === 'match-details') { await showMatchDetails(actionElement.dataset.matchId, actionElement.dataset.league); return; }
  if (action === 'settings') { state.page = 'settings'; render(); return; }
  if (action === 'select-team') { await reloadRoster(actionElement.dataset.teamId, actionElement.dataset.teamName); state.page = 'squad'; render(); return; }
  if (action === 'refresh-roster') { await reloadRoster(state.selectedTeamId, state.selectedTeamName); return; }
  if (action === 'player-details') {
    const player = state.roster.find((person) => String(person.id) === String(actionElement.dataset.playerId));
    if (player) openModal(player.name, `<div class="player-detail-modal">${avatar(player.headshot, player.name, 'xl')}<div><h3>${escapeHtml(player.name)}</h3><p>${escapeHtml(player.position || 'المركز غير متاح')}</p><p>الرقم: ${escapeHtml(player.jersey || 'غير متاح')}</p><p>العمر: ${escapeHtml(player.age ?? 'غير متاح')}</p><p>الجنسية: ${escapeHtml(player.nationality || 'غير متاحة')}</p></div></div><p class="source-note">المعلومات والصورة حسب ما أعاده المصدر الخارجي.</p>`);
    return;
  }
  if (action === 'open-predictions') { state.page = 'predictions'; render(); return; }
  if (action === 'open-lineup') { state.page = 'lineup'; render(); return; }
  if (action === 'open-saved') { state.page = 'saved'; render(); return; }
  if (action === 'open-analysis') { state.page = 'analysis'; render(); return; }
  if (action === 'open-quiz') { state.page = 'quiz'; render(); return; }
  if (action === 'open-alerts') { state.page = 'alerts'; render(); return; }
  if (action === 'quiz-answer') {
    if (state.quizAnswers[state.quizIndex] !== undefined) return;
    const answer = Number(actionElement.dataset.answerIndex);
    state.quizAnswers[state.quizIndex] = answer;
    if (answer === QUIZ_QUESTIONS[state.quizIndex].answer) state.quizScore += 1;
    render();
    return;
  }
  if (action === 'quiz-next') {
    if (state.quizIndex >= QUIZ_QUESTIONS.length - 1) state.quizDone = true;
    else state.quizIndex += 1;
    render();
    return;
  }
  if (action === 'quiz-restart') { state.quizIndex = 0; state.quizScore = 0; state.quizAnswers = {}; state.quizDone = false; render(); return; }
  if (action === 'show-sources') { sourcesModal(); return; }
  if (action === 'save-lineup') { saveLineup(); return; }
  if (action === 'clear-lineup') { state.pickedPlayers = {}; saveSetting('lineup', {}); render(); showToast('تم مسح اختيارات التشكيلة.'); return; }
  if (action === 'close-modal') { closeModal(); return; }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  if (target.id === 'team-selector') {
    const option = target.selectedOptions[0];
    await reloadRoster(target.value, option?.dataset.name || (target.value === '83' ? 'برشلونة' : 'النادي المحدد'));
    return;
  }
  if (target.id === 'formation-select') { state.formation = target.value; state.pickedPlayers = {}; render(); return; }
  if (target.id === 'setting-reduced-motion') { state.settings.reducedMotion = target.checked; saveSetting('reducedMotion', target.checked); render(); return; }
  if (target.id === 'setting-compact-mode') { state.settings.compactMode = target.checked; saveSetting('compactMode', target.checked); render(); return; }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'player-search') {
    state.rosterSearch = event.target.value || '';
    const cursor = event.target.selectionStart;
    render();
    const newInput = $('#player-search');
    if (newInput) { newInput.focus(); newInput.setSelectionRange(cursor, cursor); }
  }
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-prediction-form]');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const homeScore = Number(data.get('homeScore'));
  const awayScore = Number(data.get('awayScore'));
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0 || homeScore > 99 || awayScore > 99) {
    showToast('أدخل نتيجتين صحيحتين من 0 إلى 99.', 'error');
    return;
  }
  state.predictions = saveLocalPrediction(form.dataset.predictionForm, { homeScore, awayScore });
  render();
  showToast('تم حفظ توقعك على هذا الجهاز.', 'success');
});

document.addEventListener('error', (event) => {
  const target = event.target;
  if (target instanceof HTMLImageElement && (target.hasAttribute('data-team-image') || target.hasAttribute('data-player-image') || target.hasAttribute('data-news-image'))) {
    target.remove();
  }
}, true);

window.addEventListener('online', () => showToast('عاد الاتصال بالإنترنت. حدّث البيانات عند الحاجة.', 'success'));
window.addEventListener('offline', () => showToast('الاتصال غير متاح؛ قد تظهر بيانات محفوظة فقط.', 'error'));

render();
void loadAll();
