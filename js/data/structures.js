// Structure type IDs matching OpenDUNE
export const STRUCTURE_TYPE = {
    CONCRETE: 0,
    CONCRETE4: 1,
    PALACE: 2,
    LIGHT_FACTORY: 3,
    HEAVY_FACTORY: 4,
    HI_TECH: 5,
    IX: 6,
    WOR: 7,
    CONSTRUCTION_YARD: 8,
    WINDTRAP: 9,
    BARRACKS: 10,
    STARPORT: 11,
    REFINERY: 12,
    REPAIR: 13,
    WALL: 14,
    TURRET: 15,
    ROCKET_TURRET: 16,
    SPICE_SILO: 17,
    OUTPOST: 18
};

// Full structure stats from OpenDUNE src/table/structureinfo.c
export const STRUCTURE_DATA = {
    [STRUCTURE_TYPE.CONCRETE]: {
        name: 'Concrete Slab', hitpoints: 20, cost: 5, buildTime: 16,
        powerUsage: 0, sightRange: 1,
        tileWidth: 1, tileHeight: 1, color: '#8a8a8a',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD]
    },
    [STRUCTURE_TYPE.CONCRETE4]: {
        name: 'Large Concrete', hitpoints: 20, cost: 20, buildTime: 16,
        powerUsage: 0, sightRange: 1,
        tileWidth: 2, tileHeight: 2, color: '#8a8a8a',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD]
    },
    [STRUCTURE_TYPE.PALACE]: {
        name: 'Palace', hitpoints: 1000, cost: 999, buildTime: 130,
        powerUsage: 80, sightRange: 5,
        tileWidth: 3, tileHeight: 3, color: '#aa6644',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.STARPORT]
    },
    [STRUCTURE_TYPE.LIGHT_FACTORY]: {
        name: 'Light Factory', hitpoints: 350, cost: 400, buildTime: 96,
        powerUsage: 20, sightRange: 3,
        tileWidth: 2, tileHeight: 2, color: '#7788aa',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.REFINERY],
        builds: ['trike', 'quad']
    },
    [STRUCTURE_TYPE.HEAVY_FACTORY]: {
        name: 'Heavy Factory', hitpoints: 200, cost: 600, buildTime: 144,
        powerUsage: 35, sightRange: 3,
        tileWidth: 3, tileHeight: 3, color: '#667788',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.LIGHT_FACTORY],
        builds: ['tank', 'siege_tank', 'harvester', 'mcv', 'launcher']
    },
    [STRUCTURE_TYPE.HI_TECH]: {
        name: 'Hi-Tech Factory', hitpoints: 400, cost: 500, buildTime: 120,
        powerUsage: 35, sightRange: 3,
        tileWidth: 3, tileHeight: 3, color: '#8899aa',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.HEAVY_FACTORY],
        builds: ['carryall', 'ornithopter']
    },
    [STRUCTURE_TYPE.IX]: {
        name: 'IX Research', hitpoints: 400, cost: 500, buildTime: 120,
        powerUsage: 40, sightRange: 3,
        tileWidth: 2, tileHeight: 2, color: '#996688',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.HEAVY_FACTORY]
    },
    [STRUCTURE_TYPE.WOR]: {
        name: 'WOR', hitpoints: 400, cost: 400, buildTime: 104,
        powerUsage: 20, sightRange: 3,
        tileWidth: 2, tileHeight: 2, color: '#887766',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.BARRACKS],
        builds: ['trooper', 'troopers']
    },
    [STRUCTURE_TYPE.CONSTRUCTION_YARD]: {
        name: 'Construction Yard', hitpoints: 400, cost: 400, buildTime: 80,
        powerUsage: 0, sightRange: 3,
        tileWidth: 2, tileHeight: 2, color: '#998877',
        prerequisite: []
    },
    [STRUCTURE_TYPE.WINDTRAP]: {
        name: 'Windtrap', hitpoints: 200, cost: 300, buildTime: 48,
        powerUsage: -100, sightRange: 2,
        tileWidth: 2, tileHeight: 2, color: '#6688aa',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD]
    },
    [STRUCTURE_TYPE.BARRACKS]: {
        name: 'Barracks', hitpoints: 300, cost: 300, buildTime: 72,
        powerUsage: 10, sightRange: 2,
        tileWidth: 2, tileHeight: 2, color: '#887766',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.WINDTRAP],
        builds: ['soldier', 'infantry']
    },
    [STRUCTURE_TYPE.STARPORT]: {
        name: 'Starport', hitpoints: 500, cost: 500, buildTime: 120,
        powerUsage: 50, sightRange: 6,
        tileWidth: 3, tileHeight: 3, color: '#7799aa',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.HEAVY_FACTORY]
    },
    [STRUCTURE_TYPE.REFINERY]: {
        name: 'Refinery', hitpoints: 450, cost: 400, buildTime: 80,
        powerUsage: 30, sightRange: 4,
        tileWidth: 3, tileHeight: 2, color: '#aa8844',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.WINDTRAP],
        creditsStorage: 1005
    },
    [STRUCTURE_TYPE.REPAIR]: {
        name: 'Repair Pad', hitpoints: 200, cost: 700, buildTime: 80,
        powerUsage: 20, sightRange: 3,
        tileWidth: 3, tileHeight: 3, color: '#778877',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.HEAVY_FACTORY]
    },
    [STRUCTURE_TYPE.WALL]: {
        name: 'Wall', hitpoints: 50, cost: 50, buildTime: 40,
        powerUsage: 0, sightRange: 1,
        tileWidth: 1, tileHeight: 1, color: '#6a6a7a',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD]
    },
    [STRUCTURE_TYPE.TURRET]: {
        name: 'Turret', hitpoints: 200, cost: 125, buildTime: 64,
        powerUsage: 10, sightRange: 5, weaponRange: 5, damage: 15,
        tileWidth: 1, tileHeight: 1, color: '#888877',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.OUTPOST]
    },
    [STRUCTURE_TYPE.ROCKET_TURRET]: {
        name: 'Rocket Turret', hitpoints: 200, cost: 250, buildTime: 96,
        powerUsage: 25, sightRange: 6, weaponRange: 7, damage: 30,
        tileWidth: 1, tileHeight: 1, color: '#888899',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.OUTPOST]
    },
    [STRUCTURE_TYPE.SPICE_SILO]: {
        name: 'Spice Silo', hitpoints: 150, cost: 150, buildTime: 48,
        powerUsage: 5, sightRange: 2,
        tileWidth: 2, tileHeight: 2, color: '#aa9944',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.REFINERY],
        creditsStorage: 1000
    },
    [STRUCTURE_TYPE.OUTPOST]: {
        name: 'Outpost', hitpoints: 500, cost: 400, buildTime: 80,
        powerUsage: 30, sightRange: 10,
        tileWidth: 2, tileHeight: 2, color: '#7788aa',
        prerequisite: [STRUCTURE_TYPE.CONSTRUCTION_YARD, STRUCTURE_TYPE.WINDTRAP]
    }
};

// Structures available for building in Phase 1
export const BUILDABLE_STRUCTURES = [
    STRUCTURE_TYPE.CONCRETE,
    STRUCTURE_TYPE.WINDTRAP,
    STRUCTURE_TYPE.REFINERY,
    STRUCTURE_TYPE.SPICE_SILO,
    STRUCTURE_TYPE.LIGHT_FACTORY,
    STRUCTURE_TYPE.BARRACKS,
    STRUCTURE_TYPE.WALL,
    STRUCTURE_TYPE.TURRET,
    STRUCTURE_TYPE.HEAVY_FACTORY,
    STRUCTURE_TYPE.OUTPOST,
    STRUCTURE_TYPE.ROCKET_TURRET,
    STRUCTURE_TYPE.HI_TECH,
    STRUCTURE_TYPE.REPAIR,
    STRUCTURE_TYPE.IX,
    STRUCTURE_TYPE.STARPORT,
    STRUCTURE_TYPE.WOR,
    STRUCTURE_TYPE.PALACE
];
