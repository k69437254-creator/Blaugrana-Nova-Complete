const PREFIX = 'blaugrana-nova-v2:';

function storageAvailable() {
  try {
    const key = `${PREFIX}__test__`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const HAS_STORAGE = typeof localStorage !== 'undefined' && storageAvailable();

export function readStore(key, fallback = null) {
  if (!HAS_STORAGE) return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  if (!HAS_STORAGE) return false;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStore(key) {
  if (!HAS_STORAGE) return;
  try { localStorage.removeItem(PREFIX + key); } catch { /* storage may be restricted */ }
}

export function getApiCache(key, maxAgeMs = Infinity) {
  const entry = readStore(`api:${key}`, null);
  if (!entry || typeof entry.savedAt !== 'number' || !('data' in entry)) return null;
  if (Date.now() - entry.savedAt > maxAgeMs) return null;
  return entry;
}

export function setApiCache(key, data) {
  writeStore(`api:${key}`, { savedAt: Date.now(), data });
}

export function getSettings() {
  return {
    reducedMotion: Boolean(readStore('settings:reducedMotion', false)),
    compactMode: Boolean(readStore('settings:compactMode', false)),
    preferredLeague: readStore('settings:preferredLeague', 'esp.1'),
    language: 'ar'
  };
}

export function saveSetting(key, value) {
  return writeStore(`settings:${key}`, value);
}

export function getSavedPosts() {
  const items = readStore('savedPosts', []);
  return Array.isArray(items) ? items : [];
}

export function toggleSavedPost(item) {
  const saved = getSavedPosts();
  const id = String(item?.id ?? '');
  if (!id) return saved;
  const exists = saved.some((post) => String(post.id) === id);
  const next = exists ? saved.filter((post) => String(post.id) !== id) : [{ ...item, savedAt: Date.now() }, ...saved].slice(0, 100);
  writeStore('savedPosts', next);
  return next;
}

export function getLocalPredictions() {
  const records = readStore('predictions', {});
  return records && typeof records === 'object' ? records : {};
}

export function saveLocalPrediction(matchId, prediction) {
  const records = getLocalPredictions();
  records[String(matchId)] = { ...prediction, updatedAt: Date.now() };
  writeStore('predictions', records);
  return records;
}
