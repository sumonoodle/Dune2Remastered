/**
 * SpriteManager - Dune II faithful tile rendering
 *
 * Uses the original ICN tile sheet (terrain.png) with the autotile system
 * from OpenDUNE's Map_CreateLandscape(). The terrain.png contains 389 tiles
 * in a 16-column grid of 16x16 pixel tiles.
 *
 * The landscape icon group (ICON.MAP group 9) maps autotile indices 0-80
 * to ICN tile IDs 127-207:
 *   Index 0:     Sand (tile 127)
 *   Indices 1-16:  Rock with mountain-neighbor edge variants (tiles 128-143)
 *   Indices 17-32: Dune with same-neighbor edge variants (tiles 144-159)
 *   Indices 33-48: Mountain with same-neighbor edge variants (tiles 160-175)
 *   Indices 49-64: Spice with thick-spice-neighbor edge variants (tiles 176-191)
 *   Indices 65-80: Thick spice with same-neighbor edge variants (tiles 192-207)
 *
 * Each group of 16 tiles encodes a 4-bit neighbor mask:
 *   bit 0 (1): up neighbor matches
 *   bit 1 (2): right neighbor matches
 *   bit 2 (4): down neighbor matches
 *   bit 3 (8): left neighbor matches
 *
 * Ported directly from OpenDUNE src/map.c Map_CreateLandscape() lines 1603-1676.
 */

import { TERRAIN } from '../data/terrain.js';
import { UNIT_TYPE } from '../data/units.js';

// Landscape group base tile in the ICN sheet
const LANDSCAPE_BASE = 127;

// Tile sheet layout: 16 columns of 16x16 pixel tiles
const SHEET_COLS = 16;
const TILE_PX = 16;

// Additional tile groups from ICON.MAP
const BLOOM_TILE = 208;     // Spice bloom marker tile
const CONCRETE_TILE = 126;  // Concrete slab base

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

    /**
     * Draw a single ICN tile from terrain.png at the given screen position.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} tileID - ICN tile index (0-388)
     * @param {number} screenX - screen pixel X
     * @param {number} screenY - screen pixel Y
     * @param {number} size - draw size (scaled from 16x16)
     */
    drawTile(ctx, tileID, screenX, screenY, size) {
        const img = this.images.terrain;
        if (!img) return false;

        const col = tileID % SHEET_COLS;
        const row = Math.floor(tileID / SHEET_COLS);

        ctx.drawImage(
            img,
            col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX,
            screenX, screenY, size, size
        );
        return true;
    }

    /**
     * Draw terrain tile using the autotile sprite ID stored in the map.
     * The map pre-computes the final ICN tile ID during generation.
     */
    drawTerrainTile(ctx, spriteID, screenX, screenY, size) {
        return this.drawTile(ctx, spriteID, screenX, screenY, size);
    }

    /**
     * Draw a spice bloom marker tile.
     */
    drawBloom(ctx, screenX, screenY, size) {
        return this.drawTile(ctx, BLOOM_TILE, screenX, screenY, size);
    }

    /**
     * Draw concrete slab.
     */
    drawConcrete(ctx, screenX, screenY, size) {
        return this.drawTile(ctx, CONCRETE_TILE, screenX, screenY, size);
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
        // Structures use colored rectangles for now (Phase 2+)
        return false;
    }
}

// ============================================================
// Autotile computation — ported from OpenDUNE src/map.c
// ============================================================

/**
 * Landscape types matching OpenDUNE's LST_ enum.
 * Used internally during map generation to compute autotile indices.
 */
export const LST = {
    NORMAL_SAND:       0,
    PARTIAL_ROCK:      1,
    ENTIRELY_DUNE:     2,
    PARTIAL_DUNE:      3,
    ENTIRELY_ROCK:     4,
    MOSTLY_ROCK:       5,
    ENTIRELY_MOUNTAIN: 6,
    PARTIAL_MOUNTAIN:  7,
    SPICE:             8,
    THICK_SPICE:       9,
    CONCRETE_SLAB:    10,
    WALL:             11,
    STRUCTURE:        12,
    DESTROYED_WALL:   13,
    BLOOM_FIELD:      14,
};

/**
 * Convert a landscape type to a TERRAIN enum value for gameplay.
 */
export function lstToTerrain(lst) {
    switch (lst) {
        case LST.NORMAL_SAND:       return TERRAIN.SAND;
        case LST.PARTIAL_ROCK:      return TERRAIN.PARTIAL_ROCK;
        case LST.ENTIRELY_DUNE:     return TERRAIN.DUNE;
        case LST.PARTIAL_DUNE:      return TERRAIN.PARTIAL_DUNE;
        case LST.ENTIRELY_ROCK:     return TERRAIN.ROCK;
        case LST.MOSTLY_ROCK:       return TERRAIN.MOSTLY_ROCK;
        case LST.ENTIRELY_MOUNTAIN: return TERRAIN.MOUNTAIN;
        case LST.PARTIAL_MOUNTAIN:  return TERRAIN.PARTIAL_MOUNTAIN;
        case LST.SPICE:             return TERRAIN.SPICE;
        case LST.THICK_SPICE:       return TERRAIN.THICK_SPICE;
        case LST.CONCRETE_SLAB:     return TERRAIN.CONCRETE;
        case LST.WALL:              return TERRAIN.WALL;
        case LST.STRUCTURE:         return TERRAIN.STRUCTURE;
        case LST.DESTROYED_WALL:    return TERRAIN.DESTROYED_WALL;
        case LST.BLOOM_FIELD:       return TERRAIN.BLOOM;
        default:                    return TERRAIN.SAND;
    }
}

/**
 * Compute the autotile index (0-80) for a tile based on its landscape type
 * and its 4 cardinal neighbors' landscape types.
 *
 * Direct port of OpenDUNE src/map.c lines 1611-1655.
 *
 * @param {number} current - LST value of this tile
 * @param {number} up - LST value of neighbor above
 * @param {number} right - LST value of neighbor to the right
 * @param {number} down - LST value of neighbor below
 * @param {number} left - LST value of neighbor to the left
 * @returns {number} autotile index 0-80
 */
export function computeAutotileIndex(current, up, right, down, left) {
    let spriteID = 0;

    // Generic same-neighbor mask
    if (up    === current) spriteID |= 1;
    if (right === current) spriteID |= 2;
    if (down  === current) spriteID |= 4;
    if (left  === current) spriteID |= 8;

    switch (current) {
        case LST.NORMAL_SAND:
            spriteID = 0;
            break;

        case LST.ENTIRELY_ROCK:
            // Rock also blends with mountain neighbors
            if (up    === LST.ENTIRELY_MOUNTAIN) spriteID |= 1;
            if (right === LST.ENTIRELY_MOUNTAIN) spriteID |= 2;
            if (down  === LST.ENTIRELY_MOUNTAIN) spriteID |= 4;
            if (left  === LST.ENTIRELY_MOUNTAIN) spriteID |= 8;
            spriteID += 1;  // Range 1-16
            break;

        case LST.ENTIRELY_DUNE:
            spriteID += 17;  // Range 17-32
            break;

        case LST.ENTIRELY_MOUNTAIN:
            spriteID += 33;  // Range 33-48
            break;

        case LST.SPICE:
            // Spice blends with thick spice neighbors
            if (up    === LST.THICK_SPICE) spriteID |= 1;
            if (right === LST.THICK_SPICE) spriteID |= 2;
            if (down  === LST.THICK_SPICE) spriteID |= 4;
            if (left  === LST.THICK_SPICE) spriteID |= 8;
            spriteID += 49;  // Range 49-64
            break;

        case LST.THICK_SPICE:
            spriteID += 65;  // Range 65-80
            break;

        default:
            // Other types (partial rock, partial dune, etc.) use sand tile
            spriteID = 0;
            break;
    }

    return spriteID;
}

/**
 * Convert an autotile index (0-80) to an actual ICN tile ID.
 * This is the equivalent of the ICON.MAP landscape group lookup:
 *   g_iconMap[g_iconMap[ICM_ICONGROUP_LANDSCAPE] + autotileIndex]
 */
export function autotileToSpriteID(autotileIndex) {
    return LANDSCAPE_BASE + autotileIndex;
}

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
