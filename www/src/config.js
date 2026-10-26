export const CONFIG = Object.freeze({
  appName: 'Blaugrana Nova',
  // ESPN public soccer endpoints. They do not require a client-side API key.
  espnBase: 'https://site.api.espn.com/apis/site/v2/sports/soccer',
  leagues: [
    { id: 'esp.1', name: 'الدوري الإسباني', short: 'LaLiga' },
    { id: 'uefa.champions', name: 'دوري أبطال أوروبا', short: 'UCL' },
    { id: 'eng.1', name: 'الدوري الإنجليزي', short: 'Premier League' }
  ],
  barcelonaIds: ['83'],
  timeoutMs: 11000,
  cacheMs: 180000,
  staleMs: 86400000,
  translationEndpoint: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q='
});
