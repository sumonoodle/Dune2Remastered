import { MOVEMENT_TYPE } from './terrain.js';

// Unit type IDs
export const UNIT_TYPE = {
    CARRYALL: 0,
    ORNITHOPTER: 1,
    INFANTRY: 2,
    TROOPERS: 3,
    SOLDIER: 4,
    TROOPER: 5,
    SABOTEUR: 6,
    LAUNCHER: 7,
    DEVIATOR: 8,
    TANK: 9,
    SIEGE_TANK: 10,
    DEVASTATOR: 11,
    SONIC_TANK: 12,
    TRIKE: 13,
    RAIDER_TRIKE: 14,
    QUAD: 15,
    HARVESTER: 16,
    MCV: 17,
    SANDWORM: 25
};

// Full unit stats from OpenDUNE src/table/unitinfo.c
export const UNIT_DATA = {
    [UNIT_TYPE.CARRYALL]: {
        name: 'Carryall', hitpoints: 100, speed: 200, cost: 800,
        buildTime: 64, sightRange: 0, weaponRange: 0, damage: 0,
        movementType: MOVEMENT_TYPE.WINGER, isAirUnit: true,
        tileWidth: 1, tileHeight: 1, color: '#88aadd'
    },
    [UNIT_TYPE.ORNITHOPTER]: {
        name: "'Thopter", hitpoints: 25, speed: 150, cost: 600,
        buildTime: 96, sightRange: 5, weaponRange: 5, damage: 50,
        movementType: MOVEMENT_TYPE.WINGER, isAirUnit: true,
        tileWidth: 1, tileHeight: 1, color: '#88aadd'
    },
    [UNIT_TYPE.INFANTRY]: {
        name: 'Infantry', hitpoints: 50, speed: 5, cost: 100,
        buildTime: 32, sightRange: 3, weaponRange: 2, damage: 3,
        movementType: MOVEMENT_TYPE.FOOT,
        tileWidth: 1, tileHeight: 1, color: '#44aa44'
    },
    [UNIT_TYPE.TROOPERS]: {
        name: 'Troopers', hitpoints: 110, speed: 10, cost: 200,
        buildTime: 56, sightRange: 3, weaponRange: 5, damage: 5,
        movementType: MOVEMENT_TYPE.FOOT,
        tileWidth: 1, tileHeight: 1, color: '#44aa44'
    },
    [UNIT_TYPE.SOLDIER]: {
        name: 'Soldier', hitpoints: 20, speed: 8, cost: 60,
        buildTime: 32, sightRange: 2, weaponRange: 2, damage: 3,
        movementType: MOVEMENT_TYPE.FOOT,
        tileWidth: 1, tileHeight: 1, color: '#44aa44'
    },
    [UNIT_TYPE.TROOPER]: {
        name: 'Trooper', hitpoints: 45, speed: 15, cost: 100,
        buildTime: 56, sightRange: 3, weaponRange: 5, damage: 5,
        movementType: MOVEMENT_TYPE.FOOT,
        tileWidth: 1, tileHeight: 1, color: '#44aa44'
    },
    [UNIT_TYPE.SABOTEUR]: {
        name: 'Saboteur', hitpoints: 10, speed: 40, cost: 120,
        buildTime: 48, sightRange: 2, weaponRange: 2, damage: 2,
        movementType: MOVEMENT_TYPE.FOOT,
        tileWidth: 1, tileHeight: 1, color: '#44aa44'
    },
    [UNIT_TYPE.LAUNCHER]: {
        name: 'Launcher', hitpoints: 100, speed: 30, cost: 450,
        buildTime: 72, sightRange: 5, weaponRange: 9, damage: 75,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#8888cc'
    },
    [UNIT_TYPE.DEVIATOR]: {
        name: 'Deviator', hitpoints: 120, speed: 30, cost: 750,
        buildTime: 80, sightRange: 5, weaponRange: 7, damage: 0,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#8888cc'
    },
    [UNIT_TYPE.TANK]: {
        name: 'Tank', hitpoints: 200, speed: 25, cost: 300,
        buildTime: 64, sightRange: 3, weaponRange: 4, damage: 25,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#8888cc'
    },
    [UNIT_TYPE.SIEGE_TANK]: {
        name: 'Siege Tank', hitpoints: 300, speed: 20, cost: 600,
        buildTime: 96, sightRange: 4, weaponRange: 5, damage: 30,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#aa88cc'
    },
    [UNIT_TYPE.DEVASTATOR]: {
        name: 'Devastator', hitpoints: 400, speed: 10, cost: 800,
        buildTime: 104, sightRange: 4, weaponRange: 5, damage: 40,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#cc6666'
    },
    [UNIT_TYPE.SONIC_TANK]: {
        name: 'Sonic Tank', hitpoints: 110, speed: 30, cost: 600,
        buildTime: 104, sightRange: 4, weaponRange: 8, damage: 60,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#66aacc'
    },
    [UNIT_TYPE.TRIKE]: {
        name: 'Trike', hitpoints: 100, speed: 45, cost: 150,
        buildTime: 40, sightRange: 2, weaponRange: 3, damage: 5,
        movementType: MOVEMENT_TYPE.WHEELED,
        tileWidth: 1, tileHeight: 1, color: '#cccc66'
    },
    [UNIT_TYPE.RAIDER_TRIKE]: {
        name: 'Raider Trike', hitpoints: 80, speed: 60, cost: 150,
        buildTime: 40, sightRange: 2, weaponRange: 3, damage: 5,
        movementType: MOVEMENT_TYPE.WHEELED,
        tileWidth: 1, tileHeight: 1, color: '#cccc66'
    },
    [UNIT_TYPE.QUAD]: {
        name: 'Quad', hitpoints: 130, speed: 40, cost: 200,
        buildTime: 48, sightRange: 2, weaponRange: 3, damage: 7,
        movementType: MOVEMENT_TYPE.WHEELED,
        tileWidth: 1, tileHeight: 1, color: '#cccc66'
    },
    [UNIT_TYPE.HARVESTER]: {
        name: 'Harvester', hitpoints: 150, speed: 20, cost: 300,
        buildTime: 64, sightRange: 2, weaponRange: 0, damage: 0,
        movementType: MOVEMENT_TYPE.HARVESTER,
        tileWidth: 1, tileHeight: 1, color: '#ddaa44',
        spiceCapacity: 700
    },
    [UNIT_TYPE.MCV]: {
        name: 'MCV', hitpoints: 150, speed: 20, cost: 900,
        buildTime: 80, sightRange: 2, weaponRange: 0, damage: 0,
        movementType: MOVEMENT_TYPE.TRACKED,
        tileWidth: 1, tileHeight: 1, color: '#dddddd'
    },
    [UNIT_TYPE.SANDWORM]: {
        name: 'Sandworm', hitpoints: 1000, speed: 35, cost: 0,
        buildTime: 0, sightRange: 5, weaponRange: 0, damage: 300,
        movementType: MOVEMENT_TYPE.SLITHER,
        tileWidth: 1, tileHeight: 1, color: '#cc8844'
    }
};
