/**
 * Authentic geographic boundaries and SVG projection utilities
 * for Travel Map and Minimalist Travel Share cards.
 */

export type LatLng = [number, number]; // [latitude, longitude]

export const REAL_POLYGONS: Record<string, LatLng[]> = {
  manila: [
    [14.6011, 120.7917], [14.5856, 120.7935], [14.5784, 120.8184], [14.5708, 120.8472],
    [14.5607, 120.8816], [14.5578, 120.8936], [14.5508, 120.9103], [14.5520, 120.9237],
    [14.5569, 120.9799], [14.5579, 120.9841], [14.5587, 120.9872], [14.5591, 120.9885],
    [14.5602, 120.9929], [14.5612, 120.9970], [14.5617, 120.9987], [14.5623, 120.9994],
    [14.5636, 121.0007], [14.5651, 121.0022], [14.5670, 121.0042], [14.5684, 121.0055],
    [14.5701, 121.0072], [14.5728, 121.0099], [14.5750, 121.0122], [14.5770, 121.0142],
    [14.5794, 121.0165], [14.5806, 121.0171], [14.5825, 121.0185], [14.5847, 121.0201],
    [14.5888, 121.0227], [14.5916, 121.0240], [14.5941, 121.0262], [14.5975, 121.0249],
    [14.6010, 121.0213], [14.6044, 121.0176], [14.6072, 121.0140], [14.6116, 121.0081],
    [14.6151, 121.0036], [14.6193, 120.9979], [14.6241, 120.9918], [14.6305, 120.9912],
    [14.6369, 120.9903], [14.6383, 120.9859], [14.6367, 120.9826], [14.6381, 120.9815],
    [14.6390, 120.9807], [14.6371, 120.9794], [14.6356, 120.9743], [14.6356, 120.9636],
    [14.6342, 120.9586], [14.6346, 120.9533], [14.6395, 120.8395], [14.6247, 120.8297],
    [14.6167, 120.8208], [14.6111, 120.8086], [14.6011, 120.7917]
  ],
  metromanila: [
    [14.7600, 120.9850], [14.7500, 121.0400], [14.7300, 121.0850], [14.6900, 121.1300],
    [14.6400, 121.1400], [14.5900, 121.1200], [14.5300, 121.0850], [14.4700, 121.0500],
    [14.3800, 121.0400], [14.4100, 120.9850], [14.4700, 120.9650], [14.5300, 120.9800],
    [14.5900, 120.9700], [14.6600, 120.9500], [14.7200, 120.9500], [14.7600, 120.9850]
  ],
  baguio: [
    [16.4343, 120.5448], [16.4286, 120.5469], [16.4221, 120.5495], [16.4177, 120.5511],
    [16.4133, 120.5527], [16.4090, 120.5544], [16.4023, 120.5569], [16.3975, 120.5588],
    [16.3915, 120.5609], [16.3817, 120.5646], [16.3776, 120.5662], [16.3731, 120.5680],
    [16.3719, 120.5691], [16.3714, 120.5723], [16.3709, 120.5746], [16.3702, 120.5783],
    [16.3667, 120.5981], [16.3657, 120.6037], [16.3652, 120.6068], [16.3643, 120.6112],
    [16.3628, 120.6197], [16.3606, 120.6321], [16.3670, 120.6333], [16.3715, 120.6340],
    [16.3754, 120.6346], [16.3801, 120.6355], [16.3891, 120.6341], [16.3955, 120.6332],
    [16.4027, 120.6322], [16.4100, 120.6312], [16.4168, 120.6305], [16.4227, 120.6305],
    [16.4285, 120.6305], [16.4285, 120.6272], [16.4285, 120.6219], [16.4293, 120.6158],
    [16.4304, 120.6082], [16.4312, 120.6026], [16.4318, 120.5985], [16.4318, 120.5926],
    [16.4319, 120.5882], [16.4319, 120.5842], [16.4323, 120.5765], [16.4329, 120.5664],
    [16.4334, 120.5583], [16.4338, 120.5520], [16.4343, 120.5448]
  ],
  boracay: [
    [11.9991, 121.9253], [11.9993, 121.9231], [11.9993, 121.9214], [11.9987, 121.9205],
    [11.9979, 121.9199], [11.9970, 121.9191], [11.9965, 121.9171], [11.9961, 121.9157],
    [11.9955, 121.9136], [11.9945, 121.9115], [11.9937, 121.9101], [11.9922, 121.9082],
    [11.9905, 121.9061], [11.9892, 121.9054], [11.9881, 121.9050], [11.9830, 121.9065],
    [11.9750, 121.9100], [11.9680, 121.9125], [11.9600, 121.9140], [11.9540, 121.9155],
    [11.9480, 121.9180], [11.9440, 121.9220], [11.9470, 121.9260], [11.9540, 121.9290],
    [11.9620, 121.9315], [11.9700, 121.9330], [11.9780, 121.9350], [11.9830, 121.9360],
    [11.9890, 121.9340], [11.9942, 121.9295], [11.9974, 121.9268], [11.9991, 121.9253]
  ],
  cebu: [
    [10.3850, 123.8650], [10.3950, 123.8900], [10.3800, 123.9250], [10.3600, 123.9450],
    [10.3350, 123.9480], [10.3100, 123.9450], [10.2900, 123.9150], [10.2800, 123.8800],
    [10.2850, 123.8500], [10.3000, 123.8200], [10.3300, 123.8350], [10.3600, 123.8450],
    [10.3850, 123.8650]
  ],
  siargao: [
    [10.0300, 126.0400], [10.0100, 126.1100], [9.9500, 126.1500], [9.8700, 126.1600],
    [9.7700, 126.1400], [9.7500, 126.0600], [9.8000, 125.9900], [9.8800, 125.9700],
    [9.9600, 125.9900], [10.0300, 126.0400]
  ],
  tagaytay: [
    [14.1620, 120.9120], [14.1680, 120.9450], [14.1650, 120.9850], [14.1550, 121.0150],
    [14.1350, 121.0180], [14.1100, 121.0050], [14.0950, 120.9750], [14.0900, 120.9350],
    [14.1050, 120.9050], [14.1350, 120.9000], [14.1620, 120.9120]
  ],
  elnido: [
    [11.3300, 119.3800], [11.3300, 119.4500], [11.3100, 119.5100], [11.2500, 119.5300],
    [11.1800, 119.5200], [11.1500, 119.4600], [11.1600, 119.4000], [11.2000, 119.3600],
    [11.2600, 119.3500], [11.3300, 119.3800]
  ],
  coron: [
    [12.2200, 119.8600], [12.2400, 120.0500], [12.2100, 120.2400], [12.1200, 120.2800],
    [12.0200, 120.2500], [11.9800, 120.1500], [12.0100, 119.9500], [12.0800, 119.8600],
    [12.2200, 119.8600]
  ]
};

// Detailed regional polygons representing the Philippine archipelago provinces
export const PHILIPPINES_REGIONS: Record<string, LatLng[]> = {
  luzonNorth: [
    [18.6, 121.1], [18.5, 121.7], [18.2, 122.3], [17.5, 122.3], [16.8, 122.4],
    [16.3, 121.8], [16.1, 120.9], [16.3, 120.3], [17.2, 120.4], [18.1, 120.5],
    [18.6, 120.9]
  ],
  luzonCentral: [
    [16.1, 120.9], [16.0, 121.6], [15.3, 121.5], [14.9, 121.1], [14.8, 120.6],
    [14.8, 120.2], [15.3, 119.9], [16.0, 119.8], [16.1, 120.3]
  ],
  manila: [
    [14.76, 120.98], [14.73, 121.08], [14.64, 121.13], [14.54, 121.08], [14.42, 121.04],
    [14.44, 120.98], [14.53, 120.98], [14.62, 120.95], [14.72, 120.95], [14.76, 120.98]
  ],
  luzonSouth: [
    [14.6, 121.15], [14.6, 121.7], [14.1, 121.9], [13.7, 121.4], [13.6, 120.6],
    [14.2, 120.6], [14.4, 120.9], [14.5, 121.1]
  ],
  bicol: [
    [14.2, 122.7], [13.9, 123.4], [13.7, 124.1], [12.6, 124.1], [12.8, 123.6],
    [13.5, 123.1], [13.9, 122.2]
  ],
  palawan: [
    [12.2, 120.1], [11.9, 120.2], [11.3, 119.5], [10.2, 118.8], [9.2, 117.9],
    [8.5, 117.2], [8.9, 117.6], [9.8, 118.5], [10.8, 119.3], [11.8, 119.9],
    [12.2, 120.1]
  ],
  panay: [
    [11.99, 121.92], [11.8, 122.8], [11.5, 123.1], [10.7, 122.7], [10.5, 122.0],
    [10.9, 121.9], [11.7, 121.9], [11.99, 121.92]
  ],
  negros: [
    [11.0, 123.0], [10.8, 123.5], [10.0, 123.1], [9.1, 123.1], [9.3, 122.8],
    [9.9, 122.4], [10.4, 122.8], [11.0, 123.0]
  ],
  cebu: [
    [11.3, 124.0], [10.8, 124.0], [10.3, 123.9], [9.5, 123.3], [9.8, 123.3],
    [10.4, 123.7], [11.0, 123.9], [11.3, 124.0]
  ],
  bohol: [
    [10.1, 124.3], [9.9, 124.6], [9.6, 124.3], [9.6, 123.8], [9.9, 123.8],
    [10.1, 124.3]
  ],
  samarLeyte: [
    [12.6, 124.3], [12.5, 125.1], [11.8, 125.5], [11.1, 125.7], [10.2, 125.0],
    [10.6, 124.7], [11.3, 124.4], [12.0, 124.4]
  ],
  mindanaoNorth: [
    [9.8, 126.1], [9.5, 125.9], [8.9, 125.6], [8.6, 124.6], [8.4, 123.8],
    [8.7, 124.8], [9.0, 125.5], [9.8, 126.1]
  ],
  mindanaoDavao: [
    [8.8, 126.3], [7.1, 126.6], [6.2, 126.2], [5.5, 125.4], [6.2, 125.2],
    [7.2, 125.6], [8.0, 125.9]
  ],
  mindanaoWest: [
    [8.2, 123.2], [7.8, 122.3], [6.9, 122.1], [7.4, 123.1], [6.1, 124.5],
    [6.8, 124.1], [7.5, 124.3], [8.2, 123.2]
  ]
};

export const PHILIPPINES_CONTOURS: LatLng[][] = Object.values(PHILIPPINES_REGIONS);

export function generateOrganicBoundary(lat: number, lng: number): LatLng[] {
  const pts: LatLng[] = [];
  const steps = 16;
  const baseR = 0.045;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const variance = 1 + 0.22 * Math.sin(3 * angle) + 0.15 * Math.cos(5 * angle);
    const r = baseR * variance;
    const dLat = Math.sin(angle) * r;
    const dLng = (Math.cos(angle) * r) / Math.cos((lat * Math.PI) / 180);
    pts.push([lat + dLat, lng + dLng]);
  }
  return pts;
}

export function getBoundaryForPlace(name?: string, lat?: number, lng?: number): LatLng[][] {
  const raw = (name || '').toLowerCase().replace(/[^a-z]/g, '');

  if (raw === 'philippines' || raw === 'ph' || raw === 'pilipinas') {
    return PHILIPPINES_CONTOURS;
  }

  for (const k in REAL_POLYGONS) {
    if (raw.indexOf(k) !== -1 || k.indexOf(raw) !== -1) {
      return [REAL_POLYGONS[k]];
    }
  }

  if (lat && lng) {
    return [generateOrganicBoundary(lat, lng)];
  }

  // Fallback to Manila
  return [REAL_POLYGONS.manila];
}

/**
 * Maps visited place titles / cities to corresponding regional keys
 * so ONLY visited parts are highlighted on the country map.
 */
export function getMatchingRegionKeys(places: { cityName?: string; province?: string }[]): Set<string> {
  const matched = new Set<string>();

  places.forEach((p) => {
    const text = `${p.cityName || ''} ${p.province || ''}`.toLowerCase();
    if (text.includes('manila') || text.includes('ncr') || text.includes('makati') || text.includes('quezon') || text.includes('pasig') || text.includes('taguig')) {
      matched.add('manila');
    }
    if (text.includes('baguio') || text.includes('benguet') || text.includes('ilocos') || text.includes('cagayan') || text.includes('sagada')) {
      matched.add('luzonNorth');
    }
    if (text.includes('tagaytay') || text.includes('cavite') || text.includes('batangas') || text.includes('laguna') || text.includes('rizal')) {
      matched.add('luzonSouth');
    }
    if (text.includes('palawan') || text.includes('nido') || text.includes('coron')) {
      matched.add('palawan');
    }
    if (text.includes('boracay') || text.includes('aklan') || text.includes('iloilo')) {
      matched.add('panay');
    }
    if (text.includes('cebu') || text.includes('mactan')) {
      matched.add('cebu');
    }
    if (text.includes('bohol') || text.includes('panglao')) {
      matched.add('bohol');
    }
    if (text.includes('siargao') || text.includes('surigao')) {
      matched.add('mindanaoNorth');
    }
    if (text.includes('davao') || text.includes('samal')) {
      matched.add('mindanaoDavao');
    }
    if (text.includes('zamboanga') || text.includes('cotabato')) {
      matched.add('mindanaoWest');
    }
    if (text.includes('bicol') || text.includes('albay') || text.includes('legazpi') || text.includes('naga')) {
      matched.add('bicol');
    }
    if (text.includes('negros') || text.includes('bacolod') || text.includes('dumaguete')) {
      matched.add('negros');
    }
    if (text.includes('leyte') || text.includes('samar') || text.includes('tacloban')) {
      matched.add('samarLeyte');
    }
    if (text.includes('pampanga') || text.includes('zambales') || text.includes('clark') || text.includes('subic')) {
      matched.add('luzonCentral');
    }
  });

  // If no specific match, default to Manila
  if (matched.size === 0) {
    matched.add('manila');
  }

  return matched;
}

/**
 * Projects a dictionary of geographic regions into individual SVG path strings
 * all sharing the same global bounding box and coordinate frame.
 */
export function projectRegionsToSvgPaths(
  regions: Record<string, LatLng[]>,
  width: number,
  height: number,
  padding: number = 20
): Record<string, string> {
  const allPts: LatLng[] = Object.values(regions).flat();
  if (allPts.length === 0) return {};

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  allPts.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  const latSpan = maxLat - minLat || 0.005;
  const lngSpan = maxLng - minLng || 0.005;
  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);

  const geoW = lngSpan * Math.cos(midLatRad);
  const geoH = latSpan;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const scale = Math.min(innerW / geoW, innerH / geoH);
  const finalW = geoW * scale;
  const finalH = geoH * scale;

  const offsetX = (width - finalW) / 2;
  const offsetY = (height - finalH) / 2;

  const projectPoint = (lat: number, lng: number) => {
    const normX = ((lng - minLng) * Math.cos(midLatRad)) / geoW;
    const normY = (maxLat - lat) / geoH;
    const x = Math.round((offsetX + normX * finalW) * 10) / 10;
    const y = Math.round((offsetY + normY * finalH) * 10) / 10;
    return `${x},${y}`;
  };

  const result: Record<string, string> = {};
  for (const key in regions) {
    const ring = regions[key];
    if (ring && ring.length > 0) {
      const pts = ring.map(([lat, lng]) => projectPoint(lat, lng));
      result[key] = `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    }
  }

  return result;
}

/**
 * Projects a single place polygon into SVG path normalized inside width x height
 */
export function coordsToSvgPath(
  polygons: LatLng[][],
  width: number,
  height: number,
  padding: number = 20
): string {
  const allPts: LatLng[] = polygons.flat();
  if (allPts.length === 0) return '';

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  allPts.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  const latSpan = maxLat - minLat || 0.005;
  const lngSpan = maxLng - minLng || 0.005;
  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);

  const geoW = lngSpan * Math.cos(midLatRad);
  const geoH = latSpan;

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const scale = Math.min(innerW / geoW, innerH / geoH);
  const finalW = geoW * scale;
  const finalH = geoH * scale;

  const offsetX = (width - finalW) / 2;
  const offsetY = (height - finalH) / 2;

  const projectPoint = (lat: number, lng: number) => {
    const normX = ((lng - minLng) * Math.cos(midLatRad)) / geoW;
    const normY = (maxLat - lat) / geoH;
    const x = Math.round((offsetX + normX * finalW) * 10) / 10;
    const y = Math.round((offsetY + normY * finalH) * 10) / 10;
    return `${x},${y}`;
  };

  return polygons
    .map((ring) => {
      if (ring.length === 0) return '';
      const pts = ring.map(([lat, lng]) => projectPoint(lat, lng));
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    })
    .join(' ');
}
