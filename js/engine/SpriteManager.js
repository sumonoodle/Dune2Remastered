/**
 * SpriteManager - Dune II sprite rendering with authentic autotiling
 *
 * Terrain uses a 4-bit neighbor bitmask autotile system matching the original
 * Dune II engine (Map_CreateLandscape in map.c). Each terrain type has 16
 * tile variants selected by checking which cardinal neighbors share the same
 * terrain category. The bitmask is: up=1, right=2, down=4, left=8.
 *
 * The tile index lookup chain: terrain type + neighbor mask → autotile index
 * → ICON.MAP landscape group → ICN tile index → terrain.png sprite.
 */

import { TERRAIN } from '../data/terrain.js';
import { UNIT_TYPE } from '../data/units.js';
import { STRUCTURE_TYPE } from '../data/structures.js';

export class SpriteManager {
    constructor() {
        this.loaded = false;
        this.images = {};
        this._loadPromise = this._loadAll();
    }

    async _loadAll() {
        const sheets = ['terrain', 'units', 'units1', 'units2', 'shapes'];
        const promises = sheets.map(name => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { this.images[name] = img; resolve(); };
                img.onerror = () => { console.warn(`Failed to load ${name}.png`); resolve(); };
                img.src = `assets/${name}.png`;
            });
        });
        await Promise.all(promises);
        this.loaded = true;
        console.log('Sprites loaded:', Object.keys(this.images).join(', '));
    }

    ready() { return this.loaded; }

    /**
     * Draw a terrain tile using Dune II's autotile system.
     * Checks the 4 cardinal neighbors to select the correct transition tile.
     */
    drawTerrain(ctx, gameMap, tileX, tileY, screenX, screenY, size) {
        const img = this.images.terrain;
        if (!img) return false;

        const tile = gameMap.getTile(tileX, tileY);
        if (!tile) return false;

        const icnIdx = this._getAutotiledIndex(gameMap, tileX, tileY, tile.terrain);
        const col = icnIdx % 16;
        const row = Math.floor(icnIdx / 16);
        ctx.drawImage(img, col * 16, row * 16, 16, 16, screenX, screenY, size, size);
        return true;
    }

    /**
     * Core autotiling: replicate Dune II's Map_CreateLandscape logic.
     * Build a 4-bit neighbor mask and index into the landscape tile table.
     */
    _getAutotiledIndex(map, tx, ty, terrain) {
        // Get cardinal neighbor terrain types
        const up    = map.getTerrain(tx, ty - 1);
        const right = map.getTerrain(tx + 1, ty);
        const down  = map.getTerrain(tx, ty + 1);
        const left  = map.getTerrain(tx - 1, ty);

        // Classify terrain into rendering categories
        const cat = terrainCategory(terrain);

        switch (cat) {
            case CAT_SAND:
                return AUTOTILE_SAND;

            case CAT_ROCK: {
                // Rock checks for MOUNTAIN neighbors to create transitions
                let mask = 0;
                if (terrainCategory(up)    === CAT_MOUNTAIN) mask |= 1;
                if (terrainCategory(right) === CAT_MOUNTAIN) mask |= 2;
                if (terrainCategory(down)  === CAT_MOUNTAIN) mask |= 4;
                if (terrainCategory(left)  === CAT_MOUNTAIN) mask |= 8;
                return AUTOTILE_ROCK[mask];
            }

            case CAT_DUNE: {
                // Dune checks for same-type neighbors
                let mask = 0;
                if (terrainCategory(up)    === CAT_DUNE) mask |= 1;
                if (terrainCategory(right) === CAT_DUNE) mask |= 2;
                if (terrainCategory(down)  === CAT_DUNE) mask |= 4;
                if (terrainCategory(left)  === CAT_DUNE) mask |= 8;
                return AUTOTILE_DUNE[mask];
            }

            case CAT_MOUNTAIN: {
                let mask = 0;
                if (terrainCategory(up)    === CAT_MOUNTAIN) mask |= 1;
                if (terrainCategory(right) === CAT_MOUNTAIN) mask |= 2;
                if (terrainCategory(down)  === CAT_MOUNTAIN) mask |= 4;
                if (terrainCategory(left)  === CAT_MOUNTAIN) mask |= 8;
                return AUTOTILE_MOUNTAIN[mask];
            }

            case CAT_SPICE: {
                // Spice checks for THICK_SPICE neighbors
                let mask = 0;
                if (terrainCategory(up)    === CAT_THICK_SPICE) mask |= 1;
                if (terrainCategory(right) === CAT_THICK_SPICE) mask |= 2;
                if (terrainCategory(down)  === CAT_THICK_SPICE) mask |= 4;
                if (terrainCategory(left)  === CAT_THICK_SPICE) mask |= 8;
                return AUTOTILE_SPICE[mask];
            }

            case CAT_THICK_SPICE: {
                let mask = 0;
                if (terrainCategory(up)    === CAT_THICK_SPICE) mask |= 1;
                if (terrainCategory(right) === CAT_THICK_SPICE) mask |= 2;
                if (terrainCategory(down)  === CAT_THICK_SPICE) mask |= 4;
                if (terrainCategory(left)  === CAT_THICK_SPICE) mask |= 8;
                return AUTOTILE_THICK_SPICE[mask];
            }

            case CAT_CONCRETE:
                return AUTOTILE_CONCRETE;
            case CAT_WALL:
                return AUTOTILE_WALL;
            default:
                return AUTOTILE_SAND;
        }
    }

    drawUnit(ctx, unitType, houseId, x, y, size) {
        const mapping = UNIT_SPRITE_MAP[unitType];
        if (!mapping) return false;
        const img = this.images[mapping.sheet];
        if (!img) return false;

        const spriteSize = mapping.size;
        const cols = Math.floor(img.width / spriteSize);
        const col = mapping.frame % cols;
        const row = Math.floor(mapping.frame / cols);
        const half = size / 2;
        ctx.drawImage(img, col * spriteSize, row * spriteSize, spriteSize, spriteSize,
            x - half, y - half, size, size);
        return true;
    }

    drawStructure(ctx, structureType, x, y, width, height) {
        const mapping = STRUCTURE_SPRITE_MAP[structureType];
        if (!mapping) return false;
        const img = this.images.terrain;
        if (!img) return false;

        const tileW = width / mapping.tw;
        const tileH = height / mapping.th;
        for (let dy = 0; dy < mapping.th; dy++) {
            for (let dx = 0; dx < mapping.tw; dx++) {
                const idx = mapping.tiles[dy * mapping.tw + dx];
                if (idx < 0) continue;
                const col = idx % 16;
                const row = Math.floor(idx / 16);
                ctx.drawImage(img, col * 16, row * 16, 16, 16,
                    x + dx * tileW, y + dy * tileH, tileW, tileH);
            }
        }
        return true;
    }
}

// ============================================================
// Terrain category classification
// Maps our 15 terrain types into rendering categories
// ============================================================
const CAT_SAND = 0;
const CAT_ROCK = 1;
const CAT_DUNE = 2;
const CAT_MOUNTAIN = 3;
const CAT_SPICE = 4;
const CAT_THICK_SPICE = 5;
const CAT_CONCRETE = 6;
const CAT_WALL = 7;

function terrainCategory(terrain) {
    switch (terrain) {
        case TERRAIN.SAND:              return CAT_SAND;
        case TERRAIN.PARTIAL_ROCK:      return CAT_ROCK;
        case TERRAIN.DUNE:              return CAT_DUNE;
        case TERRAIN.PARTIAL_DUNE:      return CAT_DUNE;
        case TERRAIN.ROCK:              return CAT_ROCK;
        case TERRAIN.MOSTLY_ROCK:       return CAT_ROCK;
        case TERRAIN.MOUNTAIN:          return CAT_MOUNTAIN;
        case TERRAIN.PARTIAL_MOUNTAIN:  return CAT_MOUNTAIN;
        case TERRAIN.SPICE:             return CAT_SPICE;
        case TERRAIN.THICK_SPICE:       return CAT_THICK_SPICE;
        case TERRAIN.CONCRETE:          return CAT_CONCRETE;
        case TERRAIN.WALL:              return CAT_WALL;
        case TERRAIN.STRUCTURE:         return CAT_ROCK; // Structures sit on rock
        case TERRAIN.DESTROYED_WALL:    return CAT_ROCK;
        case TERRAIN.BLOOM:             return CAT_SAND;
        default:                        return CAT_SAND;
    }
}

// ============================================================
// Autotile lookup tables extracted from ICON.MAP
// Index by 4-bit neighbor bitmask: up=1, right=2, down=4, left=8
// Values are ICN tile indices into terrain.png
// ============================================================

// Sand: single fixed tile (no autotiling)
const AUTOTILE_SAND = 208;

// Rock: 16 variants based on which neighbors are MOUNTAIN
// mask: 0=isolated, 1=mtn above, 2=mtn right, 4=mtn below, 8=mtn left
const AUTOTILE_ROCK = [
    209, 210, 211, 212, 220, 221, 222, 229,
    230, 231, 213, 214, 215, 223, 224, 225
];

// Dune: 16 variants based on which neighbors are also DUNE
const AUTOTILE_DUNE = [
    232, 233, 234, 216, 217, 218, 226, 227,
    228, 235, 236, 237, 219, 217, 218, 226
];

// Mountain: 16 variants based on which neighbors are MOUNTAIN
const AUTOTILE_MOUNTAIN = [
    227, 228, 235, 236, 237, 238, 239, 244,
    245, 125, 240, 246, 247, 241, 242, 248
];

// Spice: 16 variants based on which neighbors are THICK_SPICE
const AUTOTILE_SPICE = [
    249, 241, 243, 248, 249, 241, 242, 248,
    250, 241, 243, 248, 250, 251, 252, 253
];

// Thick Spice: 16 variants based on which neighbors are also THICK_SPICE
const AUTOTILE_THICK_SPICE = [
    258, 259, 260, 223, 224, 225, 232, 233,
    234, 254, 255, 256, 261, 262, 263, 257
];

// Concrete and Wall: fixed tiles
const AUTOTILE_CONCRETE = 209; // Rock tile (concrete looks like rock base)
const AUTOTILE_WALL = 125;

// ============================================================
// Unit sprite mappings
// ============================================================
const UNIT_SPRITE_MAP = {
    [UNIT_TYPE.QUAD]:         { sheet: 'units', frame: 0,  size: 16 },
    [UNIT_TYPE.TRIKE]:        { sheet: 'units', frame: 5,  size: 16 },
    [UNIT_TYPE.RAIDER_TRIKE]: { sheet: 'units', frame: 5,  size: 16 },
    [UNIT_TYPE.HARVESTER]:    { sheet: 'units', frame: 10, size: 16 },
    [UNIT_TYPE.MCV]:          { sheet: 'units', frame: 15, size: 16 },
    [UNIT_TYPE.CARRYALL]:     { sheet: 'units', frame: 45, size: 16 },
    [UNIT_TYPE.ORNITHOPTER]:  { sheet: 'units', frame: 51, size: 16 },
    [UNIT_TYPE.TANK]:         { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.LAUNCHER]:     { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.DEVIATOR]:     { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.SONIC_TANK]:   { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.SIEGE_TANK]:   { sheet: 'units2', frame: 10, size: 16 },
    [UNIT_TYPE.DEVASTATOR]:   { sheet: 'units2', frame: 20, size: 16 },
    [UNIT_TYPE.SOLDIER]:      { sheet: 'units', frame: 73,  size: 16 },
    [UNIT_TYPE.INFANTRY]:     { sheet: 'units', frame: 91,  size: 16 },
    [UNIT_TYPE.TROOPER]:      { sheet: 'units', frame: 82,  size: 16 },
    [UNIT_TYPE.TROOPERS]:     { sheet: 'units', frame: 103, size: 16 },
    [UNIT_TYPE.SABOTEUR]:     { sheet: 'units', frame: 63,  size: 16 },
};

// ============================================================
// Structure sprite mappings (ICN tile compositions from ICON.MAP groups)
// Extracted from groups 12-26 of ICON.MAP
// ============================================================
const STRUCTURE_SPRITE_MAP = {
    [STRUCTURE_TYPE.CONSTRUCTION_YARD]: {
        tw: 2, th: 2, tiles: [299, 300, 301, 302]
    },
    [STRUCTURE_TYPE.WINDTRAP]: {
        tw: 2, th: 2, tiles: [304, 305, 306, 307]
    },
    [STRUCTURE_TYPE.REFINERY]: {
        tw: 3, th: 2, tiles: [345, 346, 347, 349, 350, 351]
    },
    [STRUCTURE_TYPE.LIGHT_FACTORY]: {
        tw: 2, th: 2, tiles: [251, 252, 253, 258]
    },
    [STRUCTURE_TYPE.HEAVY_FACTORY]: {
        tw: 3, th: 2, tiles: [270, 271, 272, 276, 277, 278]
    },
    [STRUCTURE_TYPE.BARRACKS]: {
        tw: 2, th: 2, tiles: [309, 310, 311, 312]
    },
    [STRUCTURE_TYPE.SPICE_SILO]: {
        tw: 2, th: 2, tiles: [285, 286, 288, 289]
    },
    [STRUCTURE_TYPE.OUTPOST]: {
        tw: 2, th: 2, tiles: [377, 378, 384, 385]
    },
    [STRUCTURE_TYPE.TURRET]: {
        tw: 1, th: 1, tiles: [364]
    },
    [STRUCTURE_TYPE.ROCKET_TURRET]: {
        tw: 1, th: 1, tiles: [372]
    },
    [STRUCTURE_TYPE.WALL]: {
        tw: 1, th: 1, tiles: [125]
    },
    [STRUCTURE_TYPE.CONCRETE]: {
        tw: 1, th: 1, tiles: [209]
    },
};
