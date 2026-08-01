/**
 * City geography data for Detour map views.
 * Provides realistic geographic features (rivers, coastlines, ring roads, arterials)
 * for featured cities, and a deterministic procedural generator for any other city.
 */

export interface GeoPolyline {
  name?: string;
  points: Array<[number, number]>; // [lat, lng]
  width?: number; // width factor
  type: "river" | "coastline" | "arterial" | "ring_road" | "boundary";
}

export interface GeoPolygon {
  name?: string;
  points: Array<[number, number]>; // [lat, lng]
  type: "water" | "park" | "district";
}

export interface CityGeography {
  cityName: string;
  cityCode: string;
  polylines: GeoPolyline[];
  polygons?: GeoPolygon[];
}

/**
 * Hand-crafted presets for featured cities.
 * Coordinates are [latitude, longitude].
 */
const CITY_PRESETS: Record<string, CityGeography> = {
  PARIS: {
    cityName: "Paris",
    cityCode: "PAR",
    polylines: [
      // River Seine winding through central Paris
      {
        name: "Seine",
        type: "river",
        width: 14,
        points: [
          [48.815, 2.420],
          [48.828, 2.388],
          [48.840, 2.370],
          [48.852, 2.356],
          [48.856, 2.346],
          [48.860, 2.330],
          [48.865, 2.298],
          [48.855, 2.274],
          [48.835, 2.260],
          [48.825, 2.245],
        ],
      },
      // Canal Saint-Martin
      {
        name: "Canal Saint-Martin",
        type: "river",
        width: 6,
        points: [
          [48.847, 2.368],
          [48.854, 2.369],
          [48.870, 2.366],
          [48.884, 2.368],
        ],
      },
      // Boulevard Périphérique (ring road)
      {
        name: "Boulevard Périphérique",
        type: "ring_road",
        width: 4,
        points: [
          [48.898, 2.350],
          [48.895, 2.385],
          [48.878, 2.410],
          [48.845, 2.415],
          [48.820, 2.390],
          [48.818, 2.340],
          [48.828, 2.275],
          [48.848, 2.252],
          [48.880, 2.280],
          [48.898, 2.350],
        ],
      },
      // Major avenues axis (Champs-Élysées / Rivoli / Nation)
      {
        name: "Avenue Axis",
        type: "arterial",
        width: 3,
        points: [
          [48.8738, 2.2950], // Arc de Triomphe
          [48.8656, 2.3212], // Place de la Concorde
          [48.8560, 2.3470], // Châtelet
          [48.8530, 2.3690], // Bastille
          [48.8480, 2.3960], // Nation
        ],
      },
      // North-South Axis (Bd Saint-Michel / Bd de Sébastopol)
      {
        name: "North-South Axis",
        type: "arterial",
        width: 3,
        points: [
          [48.8810, 2.3550], // Gare du Nord
          [48.8630, 2.3500],
          [48.8500, 2.3440], // Odéon
          [48.8350, 2.3360], // Denfert-Rochereau
        ],
      },
    ],
    polygons: [
      // Bois de Boulogne (West Park)
      {
        name: "Bois de Boulogne",
        type: "park",
        points: [
          [48.875, 2.250],
          [48.878, 2.270],
          [48.860, 2.275],
          [48.845, 2.260],
          [48.855, 2.245],
        ],
      },
      // Bois de Vincennes (East Park)
      {
        name: "Bois de Vincennes",
        type: "park",
        points: [
          [48.840, 2.420],
          [48.845, 2.450],
          [48.825, 2.460],
          [48.818, 2.430],
        ],
      },
    ],
  },

  NEW_YORK_CITY: {
    cityName: "New York City",
    cityCode: "NYC",
    polylines: [
      // Hudson River
      {
        name: "Hudson River",
        type: "river",
        width: 18,
        points: [
          [40.850, -73.945],
          [40.800, -73.972],
          [40.750, -74.008],
          [40.705, -74.018],
          [40.670, -74.040],
        ],
      },
      // East River
      {
        name: "East River",
        type: "river",
        width: 14,
        points: [
          [40.800, -73.925],
          [40.780, -73.942],
          [40.750, -73.960],
          [40.712, -73.975],
          [40.700, -73.995],
          [40.690, -74.020],
        ],
      },
      // Broadway diagonal avenue
      {
        name: "Broadway",
        type: "arterial",
        width: 3,
        points: [
          [40.810, -73.955],
          [40.770, -73.982],
          [40.755, -73.986], // Times Sq
          [40.742, -73.989], // Flatiron
          [40.722, -73.997], // SoHo
          [40.710, -74.008], // City Hall
        ],
      },
      // FDR Drive / West Side Highway perimeter
      {
        name: "Manhattan Perimeter",
        type: "ring_road",
        width: 4,
        points: [
          [40.800, -73.972],
          [40.750, -74.008],
          [40.702, -74.017],
          [40.710, -73.976],
          [40.760, -73.955],
          [40.800, -73.930],
        ],
      },
    ],
    polygons: [
      // Central Park
      {
        name: "Central Park",
        type: "park",
        points: [
          [40.800, -73.958],
          [40.796, -73.949],
          [40.764, -73.973],
          [40.768, -73.981],
        ],
      },
    ],
  },

  PHILADELPHIA: {
    cityName: "Philadelphia",
    cityCode: "PHL",
    polylines: [
      // Delaware River (East boundary)
      {
        name: "Delaware River",
        type: "river",
        width: 16,
        points: [
          [40.000, -75.070],
          [49.970, -75.120],
          [40.950, -75.138],
          [49.930, -75.140],
          [39.900, -75.145],
          [39.870, -75.180],
        ],
      },
      // Schuylkill River (Winding west)
      {
        name: "Schuylkill River",
        type: "river",
        width: 12,
        points: [
          [40.000, -75.200],
          [39.975, -75.192],
          [39.960, -75.185],
          [39.950, -75.178],
          [39.930, -75.200],
          [39.890, -75.200],
        ],
      },
      // Broad Street Axis (N-S)
      {
        name: "Broad Street",
        type: "arterial",
        width: 4,
        points: [
          [39.980, -75.158],
          [39.952, -75.163], // City Hall
          [39.900, -75.171], // Sports Complex
        ],
      },
      // Market Street Axis (E-W)
      {
        name: "Market Street",
        type: "arterial",
        width: 4,
        points: [
          [39.956, -75.195], // University City
          [39.952, -75.163], // City Hall
          [39.950, -75.140], // Penn's Landing
        ],
      },
    ],
    polygons: [
      // Fairmount Park
      {
        name: "Fairmount Park",
        type: "park",
        points: [
          [39.985, -75.205],
          [39.985, -75.185],
          [39.965, -75.180],
          [39.965, -75.200],
        ],
      },
    ],
  },

  LONDON: {
    cityName: "London",
    cityCode: "LON",
    polylines: [
      // River Thames (West to East winding curve)
      {
        name: "River Thames",
        type: "river",
        width: 16,
        points: [
          [51.480, -0.220],
          [51.465, -0.190],
          [51.485, -0.160],
          [51.495, -0.125],
          [51.508, -0.118], // Westminster/Waterloo
          [51.509, -0.090], // London Bridge
          [51.504, -0.050], // Tower Bridge / Docklands
          [51.500, -0.000], // Greenwich Reach
          [51.515,  0.030],
        ],
      },
      // Inner Ring Road
      {
        name: "Inner Ring Road",
        type: "ring_road",
        width: 4,
        points: [
          [51.528, -0.135], // Euston Rd
          [51.522, -0.080], // City Rd
          [51.510, -0.075], // Tower Hill
          [51.498, -0.100], // Elephant & Castle
          [51.485, -0.150], // Chelsea
          [51.500, -0.170], // Kensington
          [51.522, -0.165], // Marylebone
          [51.528, -0.135],
        ],
      },
    ],
    polygons: [
      // Hyde Park
      {
        name: "Hyde Park",
        type: "park",
        points: [
          [51.510, -0.175],
          [51.512, -0.155],
          [51.500, -0.150],
          [51.502, -0.170],
        ],
      },
      // Regent's Park
      {
        name: "Regent's Park",
        type: "park",
        points: [
          [51.535, -0.160],
          [51.533, -0.145],
          [51.522, -0.148],
          [51.524, -0.162],
        ],
      },
    ],
  },

  SAN_FRANCISCO: {
    cityName: "San Francisco",
    cityCode: "SFO",
    polylines: [
      // SF Bay & Ocean Coastline outline
      {
        name: "San Francisco Bay Shoreline",
        type: "coastline",
        width: 18,
        points: [
          [37.700, -122.390],
          [37.740, -122.375],
          [37.790, -122.388], // Ferry Building
          [37.808, -122.410], // Fisherman's Wharf
          [37.808, -122.475], // Golden Gate Presidio
        ],
      },
      {
        name: "Pacific Ocean Coastline",
        type: "coastline",
        width: 18,
        points: [
          [37.810, -122.478], // Golden Gate
          [37.785, -122.510], // Ocean Beach North
          [37.730, -122.505], // Ocean Beach South
        ],
      },
      // Market Street arterial axis
      {
        name: "Market Street",
        type: "arterial",
        width: 4,
        points: [
          [37.794, -122.395], // Ferry Building
          [37.785, -122.407], // Union Square
          [37.775, -122.418], // Civic Center
          [37.763, -122.435], // The Castro
        ],
      },
    ],
    polygons: [
      // Golden Gate Park
      {
        name: "Golden Gate Park",
        type: "park",
        points: [
          [37.774, -122.510],
          [37.774, -122.455],
          [37.765, -122.455],
          [37.765, -122.510],
        ],
      },
    ],
  },

  TOKYO: {
    cityName: "Tokyo",
    cityCode: "TYO",
    polylines: [
      // Tokyo Bay Shoreline
      {
        name: "Tokyo Bay Shoreline",
        type: "coastline",
        width: 18,
        points: [
          [35.600, 139.750],
          [35.630, 139.760],
          [35.650, 139.775],
          [35.640, 139.810],
          [35.620, 139.850],
        ],
      },
      // Sumida River
      {
        name: "Sumida River",
        type: "river",
        width: 12,
        points: [
          [35.730, 139.800],
          [35.710, 139.795], // Asakusa
          [35.685, 139.790],
          [35.660, 139.775],
          [35.650, 139.765],
        ],
      },
      // Yamanote Line Loop
      {
        name: "Yamanote Loop",
        type: "ring_road",
        width: 4,
        points: [
          [35.681, 139.767], // Tokyo Stn
          [35.698, 139.773], // Akihabara
          [35.713, 139.777], // Ueno
          [35.730, 139.730], // Ikebukuro
          [35.700, 139.700], // Shinjuku
          [35.658, 139.701], // Shibuya
          [35.628, 139.738], // Shinagawa
          [35.681, 139.767],
        ],
      },
    ],
    polygons: [
      // Imperial Palace Grounds
      {
        name: "Imperial Palace",
        type: "park",
        points: [
          [35.690, 139.750],
          [35.688, 139.758],
          [35.678, 139.756],
          [35.680, 139.746],
        ],
      },
    ],
  },

  CHICAGO: {
    cityName: "Chicago",
    cityCode: "CHI",
    polylines: [
      // Lake Michigan Shoreline
      {
        name: "Lake Michigan Shoreline",
        type: "coastline",
        width: 20,
        points: [
          [41.950, -87.640],
          [41.900, -87.620],
          [41.880, -87.610],
          [41.850, -87.610],
          [41.800, -87.580],
        ],
      },
      // Chicago River
      {
        name: "Chicago River",
        type: "river",
        width: 10,
        points: [
          [41.889, -87.614], // Navy Pier inlet
          [41.888, -87.635], // Wolf Point
          [41.910, -87.655], // North Branch
        ],
      },
      // Chicago River South Branch
      {
        name: "Chicago River South Branch",
        type: "river",
        width: 10,
        points: [
          [41.888, -87.635],
          [41.860, -87.636],
          [41.835, -87.650],
        ],
      },
    ],
    polygons: [
      // Millennium & Grant Park
      {
        name: "Grant Park",
        type: "park",
        points: [
          [41.888, -87.623],
          [41.888, -87.615],
          [41.865, -87.615],
          [41.865, -87.623],
        ],
      },
    ],
  },
};

/**
 * Deterministically hash a string into a number.
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Generate a procedural rough city geography for any city without an explicit preset.
 * Creates an organic river curve, ring road, and cross arterial avenues centered around centerLat, centerLng.
 */
export function generateProceduralGeography(
  cityName: string,
  centerLat: number,
  centerLng: number
): CityGeography {
  const seed = hashString(cityName);

  // Generate an organic winding river
  const riverAngle = ((seed % 180) * Math.PI) / 180; // Main angle of river
  const numRiverPoints = 7;
  const riverPoints: Array<[number, number]> = [];

  const latSpan = 0.08;
  const lngSpan = 0.12;

  for (let i = 0; i < numRiverPoints; i++) {
    const t = (i / (numRiverPoints - 1) - 0.5) * 2; // -1 to 1
    const offsetWave = Math.sin(t * Math.PI * 1.5 + (seed % 10)) * 0.015;

    const baseLat = centerLat + t * Math.sin(riverAngle) * latSpan;
    const baseLng = centerLng + t * Math.cos(riverAngle) * lngSpan;

    const perpLat = baseLat + offsetWave * Math.cos(riverAngle);
    const perpLng = baseLng - offsetWave * Math.sin(riverAngle);

    riverPoints.push([perpLat, perpLng]);
  }

  // Generate a central ring road
  const ringPoints: Array<[number, number]> = [];
  const numRingPoints = 8;
  const ringRadiusLat = 0.03 + ((seed % 7) * 0.003);
  const ringRadiusLng = 0.04 + ((seed % 11) * 0.004);

  for (let i = 0; i <= numRingPoints; i++) {
    const angle = (i / numRingPoints) * Math.PI * 2;
    const rVar = 1 + Math.sin(angle * 3 + seed) * 0.15;
    const lat = centerLat + Math.sin(angle) * ringRadiusLat * rVar;
    const lng = centerLng + Math.cos(angle) * ringRadiusLng * rVar;
    ringPoints.push([lat, lng]);
  }

  // Generate N-S and E-W main arterials
  const mainArterialEW: Array<[number, number]> = [
    [centerLat + 0.005, centerLng - lngSpan * 0.8],
    [centerLat - 0.002, centerLng],
    [centerLat + 0.008, centerLng + lngSpan * 0.8],
  ];

  const mainArterialNS: Array<[number, number]> = [
    [centerLat - latSpan * 0.8, centerLng - 0.004],
    [centerLat, centerLng + 0.002],
    [centerLat + latSpan * 0.8, centerLng - 0.001],
  ];

  // Procedural park area
  const parkLat = centerLat + ((seed % 2 === 0 ? 1 : -1) * 0.02);
  const parkLng = centerLng + ((seed % 3 === 0 ? 1 : -1) * 0.025);
  const parkPoints: Array<[number, number]> = [
    [parkLat + 0.012, parkLng - 0.015],
    [parkLat + 0.014, parkLng + 0.010],
    [parkLat - 0.008, parkLng + 0.018],
    [parkLat - 0.010, parkLng - 0.012],
  ];

  return {
    cityName,
    cityCode: cityName.slice(0, 3).toUpperCase(),
    polylines: [
      {
        name: "River",
        type: "river",
        width: 14,
        points: riverPoints,
      },
      {
        name: "Ring Road",
        type: "ring_road",
        width: 4,
        points: ringPoints,
      },
      {
        name: "East-West Avenue",
        type: "arterial",
        width: 3,
        points: mainArterialEW,
      },
      {
        name: "North-South Boulevard",
        type: "arterial",
        width: 3,
        points: mainArterialNS,
      },
    ],
    polygons: [
      {
        name: "City Park",
        type: "park",
        points: parkPoints,
      },
    ],
  };
}

/**
 * Resolves city geography for a given city name, city code, and center coordinates.
 * Normalizes city name matching (case-insensitive, stripping common prefixes).
 */
export function getCityGeography(
  cityName: string,
  cityCode?: string,
  centerLat = 48.8566,
  centerLng = 2.3522
): CityGeography {
  const normName = cityName.trim().toUpperCase().replace(/[^A-Z]/g, "_");
  const normCode = cityCode ? cityCode.trim().toUpperCase() : "";

  // Exact code match
  if (normCode && CITY_PRESETS[normCode]) {
    return CITY_PRESETS[normCode]!;
  }

  // Name match checks
  for (const [key, preset] of Object.entries(CITY_PRESETS)) {
    const pNameNorm = preset.cityName.toUpperCase().replace(/[^A-Z]/g, "_");
    if (normName === pNameNorm || normName.includes(pNameNorm) || pNameNorm.includes(normName)) {
      return preset;
    }
  }

  // Fallback to procedural generation
  return generateProceduralGeography(cityName, centerLat, centerLng);
}
