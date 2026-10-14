/**
 * Province name matching utility.
 * Maps common city/place names to their province IDs (as used in phProvinces.ts).
 */

/** Normalize any string to a stable key for fuzzy matching */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(province of|city of|municipality of)\s+/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Hardcoded city/place -> province-id aliases.
 * Province IDs match those emitted by buildPhMap.js (faeldon repo property `PROVINCE`).
 */
const ALIASES: Record<string, string> = {
  // NCR / Metro Manila
  'manila': 'metropolitan-manila',
  'metro-manila': 'metropolitan-manila',
  'ncr': 'metropolitan-manila',
  'quezon-city': 'metropolitan-manila',
  'makati': 'metropolitan-manila',
  'taguig': 'metropolitan-manila',
  'pasig': 'metropolitan-manila',
  'mandaluyong': 'metropolitan-manila',
  'marikina': 'metropolitan-manila',
  'pasay': 'metropolitan-manila',
  'paranaque': 'metropolitan-manila',
  'caloocan': 'metropolitan-manila',
  'malabon': 'metropolitan-manila',
  'navotas': 'metropolitan-manila',
  'valenzuela': 'metropolitan-manila',
  'muntinlupa': 'metropolitan-manila',
  'las-pinas': 'metropolitan-manila',
  'pateros': 'metropolitan-manila',
  'san-juan': 'metropolitan-manila',
  'bgc': 'metropolitan-manila',
  'bonifacio-global-city': 'metropolitan-manila',

  // Benguet / Baguio
  'baguio': 'benguet',
  'baguio-city': 'benguet',
  'la-trinidad': 'benguet',
  'itogon': 'benguet',
  'mankayan': 'benguet',

  // Palawan
  'el-nido': 'palawan',
  'elnido': 'palawan',
  'coron': 'palawan',
  'puerto-princesa': 'palawan',
  'puerto-princesa-city': 'palawan',
  'port-barton': 'palawan',
  'san-vicente': 'palawan',

  // Siargao -> Surigao del Norte
  'siargao': 'surigao-del-norte',
  'general-luna': 'surigao-del-norte',
  'cloud-9': 'surigao-del-norte',

  // Cebu
  'cebu': 'cebu',
  'cebu-city': 'cebu',
  'mactan': 'cebu',
  'lapu-lapu': 'cebu',
  'lapu-lapu-city': 'cebu',
  'moalboal': 'cebu',
  'oslob': 'cebu',
  'kawasan': 'cebu',

  // Aklan / Boracay
  'boracay': 'aklan',
  'kalibo': 'aklan',
  'malay': 'aklan',

  // Ilocos Norte
  'vigan': 'ilocos-sur',
  'pagudpud': 'ilocos-norte',
  'laoag': 'ilocos-norte',
  'batac': 'ilocos-norte',
  'paoay': 'ilocos-norte',

  // Ilocos Sur
  'ilocos-sur': 'ilocos-sur',

  // La Union
  'san-juan-la-union': 'la-union',
  'san-fernando-la-union': 'la-union',
  'la-union': 'la-union',

  // Davao
  'davao': 'davao-del-sur',
  'davao-city': 'davao-del-sur',
  'eden': 'davao-del-sur',

  // Bukidnon
  'bukidnon': 'bukidnon',
  'cdo': 'misamis-oriental',
  'cagayan-de-oro': 'misamis-oriental',

  // Batangas
  'batangas': 'batangas',
  'tagaytay': 'cavite',
  'anilao': 'batangas',
  'lipa': 'batangas',

  // Laguna
  'laguna': 'laguna',
  'santa-rosa': 'laguna',
  'calamba': 'laguna',
  'los-banos': 'laguna',

  // Cavite
  'cavite': 'cavite',
  'silang': 'cavite',
  'amadeo': 'cavite',

  // Rizal
  'rizal': 'rizal',
  'antipolo': 'rizal',

  // Quezon province
  'quezon': 'quezon',
  'quezon-province': 'quezon',
  'lucena': 'quezon',

  // Zambales
  'subic': 'zambales',
  'olongapo': 'zambales',
  'zambales': 'zambales',

  // Mindoro
  'el-nido-mindoro': 'occidental-mindoro',
  'coron-palawan': 'palawan',

  // Samar / Leyte
  'tacloban': 'leyte',
  'leyte': 'leyte',
  'samar': 'eastern-samar',
  'borongan': 'eastern-samar',

  // Bohol
  'bohol': 'bohol',
  'tagbilaran': 'bohol',
  'panglao': 'bohol',
  'chocolate-hills': 'bohol',

  // Negros
  'bacolod': 'negros-occidental',
  'negros-occidental': 'negros-occidental',
  'dumaguete': 'negros-oriental',
  'negros-oriental': 'negros-oriental',
  'apo-island': 'negros-oriental',

  // Cagayan
  'tuguegarao': 'cagayan',

  // Mountain Province
  'sagada': 'mountain-province',
  'bontoc': 'mountain-province',

  // Ifugao
  'banaue': 'ifugao',
  'batad': 'ifugao',

  // Batanes
  'batanes': 'batanes',
  'basco': 'batanes',
  'ivana': 'batanes',

  // Camiguin
  'camiguin': 'camiguin',
  'mambajao': 'camiguin',
};

/**
 * Given a place/city name, returns the province ID that matches a province
 * in PH_PROVINCES. Returns null if no match found.
 */
export function matchProvinceId(placeName: string): string | null {
  const key = normalizeKey(placeName);
  // Direct alias hit
  if (ALIASES[key]) return ALIASES[key];
  // Try removing common city suffixes and re-match
  const stripped = key.replace(/-city$/, '').replace(/-province$/, '');
  if (ALIASES[stripped]) return ALIASES[stripped];
  // Return key itself (may match province id directly)
  return key;
}

/**
 * Build a Set of province IDs from a list of visited place names.
 * Works with province names directly, or city names via ALIASES.
 */
export function buildVisitedProvinceIds(
  places: Array<{ cityName: string; province?: string }>
): Set<string> {
  const ids = new Set<string>();
  for (const p of places) {
    // Try province first, then city name
    const candidates = [p.province, p.cityName].filter(Boolean) as string[];
    for (const name of candidates) {
      const id = matchProvinceId(name);
      if (id) ids.add(id);
    }
  }
  return ids;
}
