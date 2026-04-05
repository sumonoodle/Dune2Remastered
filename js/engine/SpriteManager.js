/**
 * SpriteManager - loads and provides access to Dune II sprite assets
 *
 * Sprite sheets extracted from original Dune II data:
 * - terrain.png: 16x16 terrain tiles from ICON.ICN (16 cols, 13 rows = 206 tiles)
 * - units.png: 16x16 unit sprites from UNITS.SHP (16 cols, 8 rows = 117 frames)
 * - units1.png: 24x24 unit sprites from UNITS1.SHP (16 cols, 6 rows = 87 frames)
 * - units2.png: 16x16 unit sprites from UNITS2.SHP (16 cols, 3 rows = 40 frames)
 * - shapes.png: Structure/UI sprites from SHAPES.SHP
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
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.images[name] = img;
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load ${name}.png, will use fallback rendering`);
                    resolve(); // Don't reject - just skip missing sprites
                };
                img.src = `assets/${name}.png`;
            });
        });
        await Promise.all(promises);
        this.loaded = true;
        console.log('Sprites loaded:', Object.keys(this.images).join(', '));
    }

    ready() {
        return this.loaded;
    }

    /**
     * Draw a terrain tile from the ICN sprite sheet
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} terrainType - TERRAIN enum value
     * @param {number} x - screen x
     * @param {number} y - screen y
     * @param {number} size - render size (default 32)
     * @param {number} tileX - map tile x (for variation)
     * @param {number} tileY - map tile y (for variation)
     */
    drawTerrain(ctx, terrainType, x, y, size, tileX, tileY) {
        const img = this.images.terrain;
        if (!img) return false;

        const tileIdx = this._getTerrainTileIndex(terrainType, tileX, tileY);
        const col = tileIdx % 16;
        const row = Math.floor(tileIdx / 16);

        ctx.drawImage(img, col * 16, row * 16, 16, 16, x, y, size, size);
        return true;
    }

    /**
     * Draw a unit sprite
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} unitType - UNIT_TYPE enum value
     * @param {number} houseId - house color variant
     * @param {number} x - center x
     * @param {number} y - center y
     * @param {number} size - render size
     */
    drawUnit(ctx, unitType, houseId, x, y, size) {
        const mapping = UNIT_SPRITE_MAP[unitType];
        if (!mapping) return false;

        const img = this.images[mapping.sheet];
        if (!img) return false;

        const frameIdx = mapping.frame;
        const spriteSize = mapping.size;
        const cols = Math.floor(img.width / spriteSize);
        const col = frameIdx % cols;
        const row = Math.floor(frameIdx / cols);

        const halfSize = size / 2;
        ctx.drawImage(
            img,
            col * spriteSize, row * spriteSize, spriteSize, spriteSize,
            x - halfSize, y - halfSize, size, size
        );
        return true;
    }

    /**
     * Draw a structure sprite from the SHAPES sheet
     * Structures in SHAPES.SHP are variable-sized composites
     */
    drawStructure(ctx, structureType, x, y, width, height) {
        // Structures use icon tiles from ICON.ICN, composed into larger buildings
        // For now, use the shapes sheet for key structure graphics
        const mapping = STRUCTURE_SPRITE_MAP[structureType];
        if (!mapping) return false;

        const img = this.images.terrain;
        if (!img) return false;

        // Draw structure as a grid of terrain tiles
        const tileW = width / mapping.tw;
        const tileH = height / mapping.th;
        for (let dy = 0; dy < mapping.th; dy++) {
            for (let dx = 0; dx < mapping.tw; dx++) {
                const tileIdx = mapping.tiles[dy * mapping.tw + dx];
                if (tileIdx < 0) continue;
                const col = tileIdx % 16;
                const row = Math.floor(tileIdx / 16);
                ctx.drawImage(img, col * 16, row * 16, 16, 16,
                    x + dx * tileW, y + dy * tileH, tileW, tileH);
            }
        }
        return true;
    }

    /**
     * Map terrain type to an ICN tile index
     * Uses tile position for variation within the same terrain type
     */
    _getTerrainTileIndex(terrainType, tileX, tileY) {
        // Hash for consistent random variation per tile
        const hash = ((tileX * 7 + tileY * 13) & 0xFF);

        switch (terrainType) {
            // Sand tiles (top of sheet, rows 0-1)
            case TERRAIN.SAND:
                return TERRAIN_TILES.SAND[hash % TERRAIN_TILES.SAND.length];
            case TERRAIN.DUNE:
                return TERRAIN_TILES.DUNE[hash % TERRAIN_TILES.DUNE.length];
            case TERRAIN.PARTIAL_DUNE:
                return TERRAIN_TILES.PARTIAL_DUNE[hash % TERRAIN_TILES.PARTIAL_DUNE.length];

            // Rock tiles
            case TERRAIN.ROCK:
                return TERRAIN_TILES.ROCK[hash % TERRAIN_TILES.ROCK.length];
            case TERRAIN.MOSTLY_ROCK:
                return TERRAIN_TILES.MOSTLY_ROCK[hash % TERRAIN_TILES.MOSTLY_ROCK.length];
            case TERRAIN.PARTIAL_ROCK:
                return TERRAIN_TILES.PARTIAL_ROCK[hash % TERRAIN_TILES.PARTIAL_ROCK.length];

            // Mountain tiles
            case TERRAIN.MOUNTAIN:
                return TERRAIN_TILES.MOUNTAIN[hash % TERRAIN_TILES.MOUNTAIN.length];
            case TERRAIN.PARTIAL_MOUNTAIN:
                return TERRAIN_TILES.PARTIAL_MOUNTAIN[hash % TERRAIN_TILES.PARTIAL_MOUNTAIN.length];

            // Spice tiles
            case TERRAIN.SPICE:
                return TERRAIN_TILES.SPICE[hash % TERRAIN_TILES.SPICE.length];
            case TERRAIN.THICK_SPICE:
                return TERRAIN_TILES.THICK_SPICE[hash % TERRAIN_TILES.THICK_SPICE.length];

            // Built terrain
            case TERRAIN.CONCRETE:
                return TERRAIN_TILES.CONCRETE[0];
            case TERRAIN.WALL:
                return TERRAIN_TILES.WALL[0];
            case TERRAIN.STRUCTURE:
                return TERRAIN_TILES.STRUCTURE[0];
            case TERRAIN.DESTROYED_WALL:
                return TERRAIN_TILES.DESTROYED_WALL[0];
            case TERRAIN.BLOOM:
                return TERRAIN_TILES.BLOOM[0];

            default:
                return 0;
        }
    }
}

// ============================================================
// Terrain tile index mapping (indices into ICON.ICN / terrain.png)
// These are the actual tile indices visible in the sprite sheet
// Identified by examining the extracted terrain tiles
// ============================================================
// Terrain tile indices from ICN tile sheet (389 tiles, 16x16 each)
// Identified by analyzing average pixel colors per tile
const TERRAIN_TILES = {
    // Sand: uniform warm brown tiles (avg ~180,117,55)
    SAND: [144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155],

    // Dune: sand with slight variation (transition tiles)
    DUNE: [128, 129, 132, 144],
    PARTIAL_DUNE: [128, 130, 131, 134],

    // Rock: gray-green natural rock (tiles 34-95 range)
    ROCK: [37, 38, 39, 42, 43, 44, 45, 50, 65, 66, 67, 79, 82, 83, 93, 94, 95],
    MOSTLY_ROCK: [34, 35, 36, 40, 41, 46, 51, 52, 53, 68, 69],
    PARTIAL_ROCK: [47, 48, 49, 54, 55, 70, 71, 73, 74, 77, 78],

    // Mountain: very dark tiles (avg <30)
    MOUNTAIN: [1, 2, 3, 4, 5, 6, 33],
    PARTIAL_MOUNTAIN: [7, 8, 9, 10, 11, 12, 15, 160, 161],

    // Spice: orange-brown tiles (avg R>175, G~100-115)
    SPICE: [176, 177, 178, 179, 180, 181, 182, 183],
    // Thick spice: more saturated orange (avg R>170, G<93)
    THICK_SPICE: [192, 193, 194, 195, 196, 197, 198, 199],

    // Built terrain
    CONCRETE: [100],
    WALL: [124],
    STRUCTURE: [100],
    DESTROYED_WALL: [125],
    BLOOM: [127],
};

// ============================================================
// Unit sprite mappings
// Maps unit types to sprite sheet frames
// g_sprites indexing: UNITS.SHP starts at index 238
// Frame = groundSpriteID - base_index
// Each unit has 8 directional frames (N,NE,E,SE,S,SW,W,NW)
// ============================================================
const UNIT_SPRITE_MAP = {
    // UNITS.SHP (16x16 sprites)
    [UNIT_TYPE.QUAD]:         { sheet: 'units', frame: 0,  size: 16 },
    [UNIT_TYPE.TRIKE]:        { sheet: 'units', frame: 5,  size: 16 },
    [UNIT_TYPE.RAIDER_TRIKE]: { sheet: 'units', frame: 5,  size: 16 },
    [UNIT_TYPE.HARVESTER]:    { sheet: 'units', frame: 10, size: 16 },
    [UNIT_TYPE.MCV]:          { sheet: 'units', frame: 15, size: 16 },
    [UNIT_TYPE.CARRYALL]:     { sheet: 'units', frame: 45, size: 16 },
    [UNIT_TYPE.ORNITHOPTER]:  { sheet: 'units', frame: 51, size: 16 },

    // UNITS2.SHP (16x16 sprites) - heavier vehicles
    [UNIT_TYPE.TANK]:         { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.LAUNCHER]:     { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.DEVIATOR]:     { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.SONIC_TANK]:   { sheet: 'units2', frame: 0,  size: 16 },
    [UNIT_TYPE.SIEGE_TANK]:   { sheet: 'units2', frame: 10, size: 16 },
    [UNIT_TYPE.DEVASTATOR]:   { sheet: 'units2', frame: 20, size: 16 },

    // UNITS1.SHP (24x24 sprites) - larger units, infantry squads
    // Infantry in UNITS.SHP smaller frames
    [UNIT_TYPE.SOLDIER]:      { sheet: 'units', frame: 73,  size: 16 },
    [UNIT_TYPE.INFANTRY]:     { sheet: 'units', frame: 91,  size: 16 },
    [UNIT_TYPE.TROOPER]:      { sheet: 'units', frame: 82,  size: 16 },
    [UNIT_TYPE.TROOPERS]:     { sheet: 'units', frame: 103, size: 16 },
    [UNIT_TYPE.SABOTEUR]:     { sheet: 'units', frame: 63,  size: 16 },
};

// ============================================================
// Structure sprite mappings
// Maps structure types to grids of terrain tile indices
// These compose the building appearance from icon tiles
// ============================================================
const STRUCTURE_SPRITE_MAP = {
    [STRUCTURE_TYPE.CONSTRUCTION_YARD]: {
        tw: 2, th: 2, tiles: [157, 158, 173, 174]
    },
    [STRUCTURE_TYPE.WINDTRAP]: {
        tw: 2, th: 2, tiles: [160, 161, 176, 177]
    },
    [STRUCTURE_TYPE.REFINERY]: {
        tw: 3, th: 2, tiles: [163, 164, 165, 179, 180, 181]
    },
    [STRUCTURE_TYPE.LIGHT_FACTORY]: {
        tw: 2, th: 2, tiles: [148, 149, 164, 165]
    },
    [STRUCTURE_TYPE.HEAVY_FACTORY]: {
        tw: 3, th: 3, tiles: [144, 145, 146, 160, 161, 162, 176, 177, 178]
    },
    [STRUCTURE_TYPE.BARRACKS]: {
        tw: 2, th: 2, tiles: [152, 153, 168, 169]
    },
    [STRUCTURE_TYPE.SPICE_SILO]: {
        tw: 2, th: 2, tiles: [154, 155, 170, 171]
    },
    [STRUCTURE_TYPE.OUTPOST]: {
        tw: 2, th: 2, tiles: [156, 157, 172, 173]
    },
    [STRUCTURE_TYPE.TURRET]: {
        tw: 1, th: 1, tiles: [91]
    },
    [STRUCTURE_TYPE.ROCKET_TURRET]: {
        tw: 1, th: 1, tiles: [92]
    },
    [STRUCTURE_TYPE.WALL]: {
        tw: 1, th: 1, tiles: [91]
    },
    [STRUCTURE_TYPE.CONCRETE]: {
        tw: 1, th: 1, tiles: [85]
    },
};
