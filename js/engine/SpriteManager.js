/**
 * SpriteManager - Dune II sprite rendering
 *
 * Terrain tiles identified by visual inspection of extracted ICON.ICN:
 * - Row 9 (144-159): Pure sand (uniform warm brown)
 * - Row 2-5 (32-95): Rock platform (gray with channel patterns)
 * - Row 10 (160-175): Mountain/dark terrain
 * - Row 11 (176-191): Spice (orange-brown patches)
 * - Row 12 (192-207): Thick spice (saturated orange)
 * - Row 8 (128-143): Sand/rock transition tiles
 * - Tile 208: Reference flat sand tile
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
        const promises = sheets.map(name => new Promise(resolve => {
            const img = new Image();
            img.onload = () => { this.images[name] = img; resolve(); };
            img.onerror = () => { console.warn(`Failed to load ${name}.png`); resolve(); };
            img.src = `assets/${name}.png`;
        }));
        await Promise.all(promises);
        this.loaded = true;
        console.log('Sprites loaded:', Object.keys(this.images).join(', '));
    }

    ready() { return this.loaded; }

    /** Draw a terrain tile with neighbor-aware autotiling */
    drawTerrain(ctx, gameMap, tileX, tileY, screenX, screenY, size) {
        const img = this.images.terrain;
        if (!img) return false;

        const tile = gameMap.getTile(tileX, tileY);
        if (!tile) return false;

        const terrain = tile.terrain;
        const cat = terrainCategory(terrain);

        // Get neighbor categories for edge blending
        const upCat    = terrainCategory(gameMap.getTerrain(tileX, tileY - 1));
        const rightCat = terrainCategory(gameMap.getTerrain(tileX + 1, tileY));
        const downCat  = terrainCategory(gameMap.getTerrain(tileX, tileY + 1));
        const leftCat  = terrainCategory(gameMap.getTerrain(tileX - 1, tileY));

        // Consistent hash for tile variation
        const hash = ((tileX * 2654435761 + tileY * 340573321) >>> 0) & 0xFF;

        // Select tile based on terrain category and neighbors
        let tileIdx;
        switch (cat) {
            case CAT_SAND:
                // Use sand tiles with slight variation
                tileIdx = SAND_TILES[hash % SAND_TILES.length];
                break;

            case CAT_ROCK: {
                // Rock interior: use solid rock tiles
                // Check if any neighbor is sand (edge tile needed)
                const hasSandNeighbor = (upCat === CAT_SAND || rightCat === CAT_SAND ||
                                        downCat === CAT_SAND || leftCat === CAT_SAND);
                if (hasSandNeighbor) {
                    // Use sand/rock transition tiles (row 8)
                    // Build mask: which directions have rock/non-sand
                    let mask = 0;
                    if (upCat !== CAT_SAND && upCat !== CAT_DUNE)    mask |= 1;
                    if (rightCat !== CAT_SAND && rightCat !== CAT_DUNE) mask |= 2;
                    if (downCat !== CAT_SAND && downCat !== CAT_DUNE)  mask |= 4;
                    if (leftCat !== CAT_SAND && leftCat !== CAT_DUNE)  mask |= 8;
                    tileIdx = ROCK_EDGE_TILES[mask % ROCK_EDGE_TILES.length];
                } else {
                    // Interior rock - use solid rock tiles with variation
                    tileIdx = ROCK_CENTER_TILES[hash % ROCK_CENTER_TILES.length];
                }
                break;
            }

            case CAT_DUNE: {
                // Dunes: sand with dune patterns
                const hasSandN = (upCat === CAT_SAND || rightCat === CAT_SAND ||
                                  downCat === CAT_SAND || leftCat === CAT_SAND);
                if (hasSandN) {
                    tileIdx = DUNE_EDGE_TILES[hash % DUNE_EDGE_TILES.length];
                } else {
                    tileIdx = DUNE_CENTER_TILES[hash % DUNE_CENTER_TILES.length];
                }
                break;
            }

            case CAT_MOUNTAIN: {
                // Mountain: dark elevated terrain
                const allMtn = (upCat === CAT_MOUNTAIN && rightCat === CAT_MOUNTAIN &&
                               downCat === CAT_MOUNTAIN && leftCat === CAT_MOUNTAIN);
                if (allMtn) {
                    tileIdx = MOUNTAIN_CENTER_TILES[hash % MOUNTAIN_CENTER_TILES.length];
                } else {
                    tileIdx = MOUNTAIN_EDGE_TILES[hash % MOUNTAIN_EDGE_TILES.length];
                }
                break;
            }

            case CAT_SPICE: {
                // Spice: orange patches on sandy base
                const hasThick = (upCat === CAT_THICK_SPICE || rightCat === CAT_THICK_SPICE ||
                                 downCat === CAT_THICK_SPICE || leftCat === CAT_THICK_SPICE);
                if (hasThick) {
                    tileIdx = SPICE_DENSE_TILES[hash % SPICE_DENSE_TILES.length];
                } else {
                    tileIdx = SPICE_TILES[hash % SPICE_TILES.length];
                }
                break;
            }

            case CAT_THICK_SPICE: {
                const allThick = (upCat === CAT_THICK_SPICE && rightCat === CAT_THICK_SPICE &&
                                 downCat === CAT_THICK_SPICE && leftCat === CAT_THICK_SPICE);
                if (allThick) {
                    tileIdx = THICK_SPICE_CENTER_TILES[hash % THICK_SPICE_CENTER_TILES.length];
                } else {
                    tileIdx = THICK_SPICE_EDGE_TILES[hash % THICK_SPICE_EDGE_TILES.length];
                }
                break;
            }

            case CAT_CONCRETE:
                tileIdx = CONCRETE_TILES[hash % CONCRETE_TILES.length];
                break;

            case CAT_WALL:
                tileIdx = 125; // Wall tile
                break;

            default:
                tileIdx = SAND_TILES[0];
        }

        const col = tileIdx % 16;
        const row = Math.floor(tileIdx / 16);
        ctx.drawImage(img, col * 16, row * 16, 16, 16, screenX, screenY, size, size);
        return true;
    }

    drawUnit(ctx, unitType, houseId, x, y, size) {
        const mapping = UNIT_SPRITE_MAP[unitType];
        if (!mapping) return false;
        const img = this.images[mapping.sheet];
        if (!img) return false;
        const cols = Math.floor(img.width / mapping.size);
        const col = mapping.frame % cols;
        const row = Math.floor(mapping.frame / cols);
        const half = size / 2;
        ctx.drawImage(img, col * mapping.size, row * mapping.size, mapping.size, mapping.size,
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
// ============================================================
const CAT_SAND = 0, CAT_ROCK = 1, CAT_DUNE = 2, CAT_MOUNTAIN = 3;
const CAT_SPICE = 4, CAT_THICK_SPICE = 5, CAT_CONCRETE = 6, CAT_WALL = 7;

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
        case TERRAIN.STRUCTURE:         return CAT_ROCK;
        case TERRAIN.DESTROYED_WALL:    return CAT_ROCK;
        case TERRAIN.BLOOM:             return CAT_SAND;
        default:                        return CAT_SAND;
    }
}

// ============================================================
// Tile index tables (verified by visual inspection of ICN sheet)
//
// ICN tile layout (16 tiles per row, 16x16 pixels each):
//   Row 0-1 (0-31):     Craters, effects, dead bodies
//   Row 2-5 (32-95):    Rock platform tiles (gray channels)
//   Row 6 (96-107):     Rock/concrete variants; (108-127): fog/dark
//   Row 8 (128-143):    Sand ↔ rock transition tiles
//   Row 9 (144-159):    Pure sand (uniform warm brown)
//   Row 10 (160-175):   Dark terrain (mountain edges/transitions)
//   Row 11 (176-191):   Spice (orange-brown on sandy base)
//   Row 12 (192-207):   Thick spice (saturated orange)
//   Tile 208-209:       Reference sand tiles
// ============================================================

// Sand: warm brown desert — uses tiles from row 9 + tile 208
const SAND_TILES = [144, 145, 146, 147, 148, 149, 150, 151, 208];

// Rock center: solid gray platform — from rows 2-5, pick uniform interior tiles
const ROCK_CENTER_TILES = [37, 38, 42, 43, 44, 50, 56, 65, 66];

// Rock edge: sand-to-rock transitions — from row 8
const ROCK_EDGE_TILES = [128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143];

// Dune center and edge tiles — sand with dune ridges
const DUNE_CENTER_TILES = [144, 145, 146, 147]; // Similar to sand but different variation
const DUNE_EDGE_TILES = [148, 149, 150, 151];

// Mountain: dark elevated terrain — from row 10
const MOUNTAIN_CENTER_TILES = [164, 165, 166, 167, 168, 169];
const MOUNTAIN_EDGE_TILES = [160, 161, 162, 163, 170, 171];

// Spice: orange-brown patches — from row 11
const SPICE_TILES = [176, 177, 178, 179, 180, 181, 182, 183];
const SPICE_DENSE_TILES = [184, 185, 186, 187, 188, 189, 190, 191];

// Thick spice: saturated orange — from row 12
const THICK_SPICE_CENTER_TILES = [196, 197, 198, 199, 200, 201, 202, 203];
const THICK_SPICE_EDGE_TILES = [192, 193, 194, 195, 204, 205, 206, 207];

// Concrete: flat gray slab tiles — from row 6
const CONCRETE_TILES = [96, 97, 98, 99];

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
// Structure sprite mappings (ICN tile compositions)
// Uses rock/concrete tiles for building bases
// ============================================================
const STRUCTURE_SPRITE_MAP = {
    [STRUCTURE_TYPE.CONSTRUCTION_YARD]: { tw: 2, th: 2, tiles: [37, 38, 42, 43] },
    [STRUCTURE_TYPE.WINDTRAP]:          { tw: 2, th: 2, tiles: [50, 56, 65, 66] },
    [STRUCTURE_TYPE.REFINERY]:          { tw: 3, th: 2, tiles: [37, 38, 44, 42, 43, 50] },
    [STRUCTURE_TYPE.LIGHT_FACTORY]:     { tw: 2, th: 2, tiles: [44, 56, 65, 66] },
    [STRUCTURE_TYPE.HEAVY_FACTORY]:     { tw: 3, th: 2, tiles: [37, 38, 44, 56, 65, 66] },
    [STRUCTURE_TYPE.BARRACKS]:          { tw: 2, th: 2, tiles: [42, 43, 56, 65] },
    [STRUCTURE_TYPE.SPICE_SILO]:        { tw: 2, th: 2, tiles: [37, 38, 42, 43] },
    [STRUCTURE_TYPE.OUTPOST]:           { tw: 2, th: 2, tiles: [50, 56, 65, 66] },
    [STRUCTURE_TYPE.TURRET]:            { tw: 1, th: 1, tiles: [37] },
    [STRUCTURE_TYPE.ROCKET_TURRET]:     { tw: 1, th: 1, tiles: [38] },
    [STRUCTURE_TYPE.WALL]:              { tw: 1, th: 1, tiles: [125] },
    [STRUCTURE_TYPE.CONCRETE]:          { tw: 1, th: 1, tiles: [96] },
};
