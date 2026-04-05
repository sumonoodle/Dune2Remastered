// Terrain types matching original Dune II (from OpenDUNE src/map.h)
export const TERRAIN = {
    SAND: 0,
    PARTIAL_ROCK: 1,
    DUNE: 2,
    PARTIAL_DUNE: 3,
    ROCK: 4,
    MOSTLY_ROCK: 5,
    MOUNTAIN: 6,
    PARTIAL_MOUNTAIN: 7,
    SPICE: 8,
    THICK_SPICE: 9,
    CONCRETE: 10,
    WALL: 11,
    STRUCTURE: 12,
    DESTROYED_WALL: 13,
    BLOOM: 14
};

// Colors for rendering each terrain type
export const TERRAIN_COLORS = {
    [TERRAIN.SAND]:             '#c2a456',
    [TERRAIN.PARTIAL_ROCK]:     '#9a8a5a',
    [TERRAIN.DUNE]:             '#d4b060',
    [TERRAIN.PARTIAL_DUNE]:     '#c8a84e',
    [TERRAIN.ROCK]:             '#6e6e5a',
    [TERRAIN.MOSTLY_ROCK]:      '#7a7a66',
    [TERRAIN.MOUNTAIN]:         '#5a5a48',
    [TERRAIN.PARTIAL_MOUNTAIN]: '#646452',
    [TERRAIN.SPICE]:            '#d49030',
    [TERRAIN.THICK_SPICE]:      '#e07818',
    [TERRAIN.CONCRETE]:         '#8a8a8a',
    [TERRAIN.WALL]:             '#6a6a7a',
    [TERRAIN.STRUCTURE]:        '#555566',
    [TERRAIN.DESTROYED_WALL]:   '#4a4a3a',
    [TERRAIN.BLOOM]:            '#e88830'
};

// Minimap colors (darker/more distinct for small rendering)
export const TERRAIN_MINIMAP_COLORS = {
    [TERRAIN.SAND]:             '#b09040',
    [TERRAIN.PARTIAL_ROCK]:     '#807050',
    [TERRAIN.DUNE]:             '#c0a050',
    [TERRAIN.PARTIAL_DUNE]:     '#b89848',
    [TERRAIN.ROCK]:             '#585848',
    [TERRAIN.MOSTLY_ROCK]:      '#686858',
    [TERRAIN.MOUNTAIN]:         '#404038',
    [TERRAIN.PARTIAL_MOUNTAIN]: '#505046',
    [TERRAIN.SPICE]:            '#c07820',
    [TERRAIN.THICK_SPICE]:      '#d06010',
    [TERRAIN.CONCRETE]:         '#707070',
    [TERRAIN.WALL]:             '#505060',
    [TERRAIN.STRUCTURE]:        '#404050',
    [TERRAIN.DESTROYED_WALL]:   '#3a3a30',
    [TERRAIN.BLOOM]:            '#d07020'
};

// Movement cost multipliers by terrain for different movement types
// 0 = impassable, lower = slower, 255 = fastest
// Index: [foot, tracked, harvester, wheeled, winger, slither]
export const TERRAIN_MOVEMENT = {
    [TERRAIN.SAND]:             [112, 112, 112, 160, 255, 192],
    [TERRAIN.PARTIAL_ROCK]:     [112, 160, 160, 160, 255, 0],
    [TERRAIN.DUNE]:             [112, 160, 160, 160, 255, 192],
    [TERRAIN.PARTIAL_DUNE]:     [112, 160, 160, 160, 255, 192],
    [TERRAIN.ROCK]:             [112, 160, 160, 160, 255, 0],
    [TERRAIN.MOSTLY_ROCK]:      [112, 160, 160, 160, 255, 0],
    [TERRAIN.MOUNTAIN]:         [64,  0,   0,   0,   255, 0],
    [TERRAIN.PARTIAL_MOUNTAIN]: [80,  0,   0,   0,   255, 0],
    [TERRAIN.SPICE]:            [112, 112, 112, 160, 255, 192],
    [TERRAIN.THICK_SPICE]:      [112, 112, 112, 160, 255, 192],
    [TERRAIN.CONCRETE]:         [255, 255, 255, 255, 255, 0],
    [TERRAIN.WALL]:             [0,   0,   0,   0,   255, 0],
    [TERRAIN.STRUCTURE]:        [0,   0,   0,   0,   255, 0],
    [TERRAIN.DESTROYED_WALL]:   [112, 160, 160, 160, 255, 0],
    [TERRAIN.BLOOM]:            [112, 112, 112, 160, 255, 192]
};

export const MOVEMENT_TYPE = {
    FOOT: 0,
    TRACKED: 1,
    HARVESTER: 2,
    WHEELED: 3,
    WINGER: 4,
    SLITHER: 5
};

// Which terrains are valid for structure placement
export function canBuildOn(terrainType) {
    return terrainType === TERRAIN.ROCK ||
           terrainType === TERRAIN.MOSTLY_ROCK ||
           terrainType === TERRAIN.PARTIAL_ROCK ||
           terrainType === TERRAIN.CONCRETE;
}

// Which terrains can grow spice
export function canGrowSpice(terrainType) {
    return terrainType === TERRAIN.SAND ||
           terrainType === TERRAIN.DUNE ||
           terrainType === TERRAIN.PARTIAL_DUNE ||
           terrainType === TERRAIN.SPICE;
}
