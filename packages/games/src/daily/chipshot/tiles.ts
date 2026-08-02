import type { TileShape, TileTemplate } from './types';

export function straightTile(): TileTemplate {
  return {
    shape: 'straight',
    walls: [
      { a: { x: 100, y: 50 }, b: { x: 300, y: 50 } },
      { a: { x: 300, y: 50 }, b: { x: 300, y: 350 } },
      { a: { x: 300, y: 350 }, b: { x: 100, y: 350 } },
      { a: { x: 100, y: 350 }, b: { x: 100, y: 50 } },
    ],
    obstacleZones: [
      { center: { x: 200, y: 150 }, radius: 40 },
      { center: { x: 200, y: 250 }, radius: 40 },
    ],
    teeCandidates: [
      { x: 200, y: 300 }
    ],
    cupCandidates: [
      { x: 200, y: 100 }
    ]
  };
}

export function cornerTile(): TileTemplate {
  return {
    shape: 'corner',
    walls: [
      { a: { x: 50, y: 50 }, b: { x: 350, y: 50 } },
      { a: { x: 350, y: 50 }, b: { x: 350, y: 350 } },
      { a: { x: 350, y: 350 }, b: { x: 200, y: 350 } },
      { a: { x: 200, y: 350 }, b: { x: 200, y: 200 } },
      { a: { x: 200, y: 200 }, b: { x: 50, y: 200 } },
      { a: { x: 50, y: 200 }, b: { x: 50, y: 50 } },
    ],
    obstacleZones: [
      { center: { x: 275, y: 125 }, radius: 40 },
      { center: { x: 125, y: 125 }, radius: 30 },
      { center: { x: 275, y: 275 }, radius: 30 },
    ],
    teeCandidates: [
      { x: 100, y: 125 }
    ],
    cupCandidates: [
      { x: 275, y: 300 }
    ]
  };
}

export function doglegTile(): TileTemplate {
  return {
    shape: 'dogleg',
    walls: [
      { a: { x: 100, y: 350 }, b: { x: 100, y: 200 } },
      { a: { x: 100, y: 200 }, b: { x: 200, y: 200 } },
      { a: { x: 200, y: 200 }, b: { x: 200, y: 50 } },
      { a: { x: 200, y: 50 }, b: { x: 300, y: 50 } },
      { a: { x: 300, y: 50 }, b: { x: 300, y: 300 } },
      { a: { x: 300, y: 300 }, b: { x: 200, y: 300 } },
      { a: { x: 200, y: 300 }, b: { x: 200, y: 350 } },
      { a: { x: 200, y: 350 }, b: { x: 100, y: 350 } },
    ],
    obstacleZones: [
      { center: { x: 150, y: 250 }, radius: 30 },
      { center: { x: 250, y: 250 }, radius: 30 },
      { center: { x: 250, y: 150 }, radius: 30 },
    ],
    teeCandidates: [
      { x: 150, y: 300 }
    ],
    cupCandidates: [
      { x: 250, y: 100 }
    ]
  };
}

export function openTile(): TileTemplate {
  return {
    shape: 'open',
    walls: [
      { a: { x: 100, y: 50 }, b: { x: 300, y: 50 } },
      { a: { x: 300, y: 50 }, b: { x: 350, y: 100 } },
      { a: { x: 350, y: 100 }, b: { x: 350, y: 300 } },
      { a: { x: 350, y: 300 }, b: { x: 300, y: 350 } },
      { a: { x: 300, y: 350 }, b: { x: 100, y: 350 } },
      { a: { x: 100, y: 350 }, b: { x: 50, y: 300 } },
      { a: { x: 50, y: 300 }, b: { x: 50, y: 100 } },
      { a: { x: 50, y: 100 }, b: { x: 100, y: 50 } },
    ],
    obstacleZones: [
      { center: { x: 200, y: 200 }, radius: 60 },
      { center: { x: 120, y: 150 }, radius: 30 },
      { center: { x: 280, y: 250 }, radius: 30 },
    ],
    teeCandidates: [
      { x: 200, y: 300 },
      { x: 100, y: 200 }
    ],
    cupCandidates: [
      { x: 200, y: 100 },
      { x: 300, y: 200 }
    ]
  };
}

export function funnelTile(): TileTemplate {
  return {
    shape: 'funnel',
    walls: [
      { a: { x: 50, y: 350 }, b: { x: 350, y: 350 } },
      { a: { x: 350, y: 350 }, b: { x: 250, y: 50 } },
      { a: { x: 250, y: 50 }, b: { x: 150, y: 50 } },
      { a: { x: 150, y: 50 }, b: { x: 50, y: 350 } },
    ],
    obstacleZones: [
      { center: { x: 200, y: 200 }, radius: 40 },
      { center: { x: 150, y: 280 }, radius: 25 },
      { center: { x: 250, y: 280 }, radius: 25 },
    ],
    teeCandidates: [
      { x: 200, y: 300 }
    ],
    cupCandidates: [
      { x: 200, y: 100 }
    ]
  };
}

export function getTile(shape: TileShape): TileTemplate {
  switch (shape) {
    case 'straight': return straightTile();
    case 'corner': return cornerTile();
    case 'dogleg': return doglegTile();
    case 'open': return openTile();
    case 'funnel': return funnelTile();
    default: return straightTile();
  }
}
