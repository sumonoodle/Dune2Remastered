/**
 * SpriteManager - Dune II sprite rendering
 *
 * Terrain uses an overlay-based system inspired by the actual Dune II look:
 * - Sand tile 208 is drawn as the base everywhere
 * - Other terrain types are rendered as colored overlays on top
 * - Edge blending creates smooth transitions between terrain types
 * - Spice is drawn as orange speckles, mountains as dark patches
 *
 * This matches the Dune Dynasty screenshots where terrain forms smooth,
 * contiguous regions with organic edges.
 */

import { TERRAIN } from '../data/terrain.js';
import { UNIT_TYPE } from '../data/units.js';
import { STRUCTURE_TYPE } from '../data/structures.js';

// Sand tile ICN index — row 9, col 0 (flat uniform sand, no bloom pattern)
// Tile 208 has a circular spice bloom marker and must NOT be used as base sand
const SAND_TILE_IDX = 144;

export class SpriteManager {
    constructor() {
        this.loaded = false;
        this.images = {};
        this._noiseCache = new Map();
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
     * Draw terrain using sand base + colored overlays with edge blending.
     * This produces smooth, contiguous terrain regions like the original game.
     */
    drawTerrain(ctx, gameMap, tileX, tileY, screenX, screenY, size) {
        const img = this.images.terrain;
        if (!img) return false;

        const tile = gameMap.getTile(tileX, tileY);
        if (!tile) return false;

        // Step 1: Draw sand base tile everywhere
        const sandCol = SAND_TILE_IDX % 16;
        const sandRow = Math.floor(SAND_TILE_IDX / 16);
        ctx.drawImage(img, sandCol * 16, sandRow * 16, 16, 16, screenX, screenY, size, size);

        const terrain = tile.terrain;
        const cat = terrainCategory(terrain);

        // Sand needs no overlay
        if (cat === CAT_SAND) return true;

        // Step 2: Get neighbor info for edge blending
        const upCat    = terrainCategory(gameMap.getTerrain(tileX, tileY - 1));
        const rightCat = terrainCategory(gameMap.getTerrain(tileX + 1, tileY));
        const downCat  = terrainCategory(gameMap.getTerrain(tileX, tileY + 1));
        const leftCat  = terrainCategory(gameMap.getTerrain(tileX - 1, tileY));

        // Count how many neighbors share our category (for interior vs edge detection)
        let sameNeighbors = 0;
        if (upCat === cat) sameNeighbors++;
        if (rightCat === cat) sameNeighbors++;
        if (downCat === cat) sameNeighbors++;
        if (leftCat === cat) sameNeighbors++;

        // Interior tiles (surrounded by same type) get full overlay
        // Edge tiles get reduced overlay for smooth blending
        const isInterior = sameNeighbors === 4;
        const hash = this._tileHash(tileX, tileY);

        // Step 3: Draw terrain-specific overlay
        switch (cat) {
            case CAT_ROCK:
                this._drawRockOverlay(ctx, screenX, screenY, size, isInterior,
                    upCat === cat, rightCat === cat, downCat === cat, leftCat === cat, hash);
                break;
            case CAT_DUNE:
                this._drawDuneOverlay(ctx, screenX, screenY, size, hash);
                break;
            case CAT_MOUNTAIN:
                this._drawMountainOverlay(ctx, screenX, screenY, size, isInterior,
                    upCat === cat, rightCat === cat, downCat === cat, leftCat === cat, hash);
                break;
            case CAT_SPICE:
                this._drawSpiceOverlay(ctx, screenX, screenY, size, false,
                    upCat === CAT_THICK_SPICE || upCat === CAT_SPICE,
                    rightCat === CAT_THICK_SPICE || rightCat === CAT_SPICE,
                    downCat === CAT_THICK_SPICE || downCat === CAT_SPICE,
                    leftCat === CAT_THICK_SPICE || leftCat === CAT_SPICE, hash);
                break;
            case CAT_THICK_SPICE:
                this._drawSpiceOverlay(ctx, screenX, screenY, size, true,
                    upCat === CAT_THICK_SPICE || upCat === CAT_SPICE,
                    rightCat === CAT_THICK_SPICE || rightCat === CAT_SPICE,
                    downCat === CAT_THICK_SPICE || downCat === CAT_SPICE,
                    leftCat === CAT_THICK_SPICE || leftCat === CAT_SPICE, hash);
                break;
            case CAT_CONCRETE:
                this._drawConcreteOverlay(ctx, screenX, screenY, size);
                break;
            case CAT_WALL:
                this._drawWallOverlay(ctx, screenX, screenY, size);
                break;
        }

        return true;
    }

    /**
     * Rock: dark charcoal with rough speckled texture, matching original Dune II.
     * In the real game, rock is almost black with a craggy gravel-like surface.
     * Edge tiles blend smoothly into sand via gradient fade.
     */
    _drawRockOverlay(ctx, x, y, s, interior, up, right, down, left, hash) {
        // Heavy dark fill — rock in Dune II is very dark (almost black)
        ctx.fillStyle = 'rgba(25, 22, 18, 0.82)';
        ctx.fillRect(x, y, s, s);

        // Rough speckled texture — small lighter flecks like gravel
        const speckleCount = 8;
        for (let i = 0; i < speckleCount; i++) {
            const sx = x + ((hash * (i + 1) * 17) % 100) / 100 * s;
            const sy = y + ((hash * (i + 1) * 31 + 47) % 100) / 100 * s;
            const brightness = 60 + ((hash * (i + 3)) % 40);
            ctx.fillStyle = `rgba(${brightness}, ${brightness - 5}, ${brightness - 15}, 0.4)`;
            ctx.fillRect(sx, sy, s * 0.08, s * 0.08);
        }

        // Smooth edge fade where rock meets sand
        this._drawEdgeFade(ctx, x, y, s, up, right, down, left, s * 0.4);
    }

    /** Dune: warm tint with subtle wave pattern */
    _drawDuneOverlay(ctx, x, y, s, hash) {
        ctx.fillStyle = 'rgba(210, 165, 80, 0.15)';
        ctx.fillRect(x, y, s, s);
        const ridgeY = y + (hash % 3 + 1) * s * 0.25;
        ctx.fillStyle = 'rgba(230, 180, 90, 0.12)';
        ctx.fillRect(x, ridgeY, s, s * 0.15);
    }

    /**
     * Mountain: very dark, craggy rock — even darker than regular rock.
     * Mountains are the darkest terrain, almost pitch black at center.
     */
    _drawMountainOverlay(ctx, x, y, s, interior, up, right, down, left, hash) {
        // Very heavy dark fill
        ctx.fillStyle = `rgba(15, 12, 8, ${interior ? 0.88 : 0.78})`;
        ctx.fillRect(x, y, s, s);

        // Rough rocky texture — slightly lighter speckles
        for (let i = 0; i < 6; i++) {
            const sx = x + ((hash * (i + 1) * 23) % 100) / 100 * s;
            const sy = y + ((hash * (i + 1) * 37 + 19) % 100) / 100 * s;
            const b = 40 + ((hash * (i + 7)) % 30);
            ctx.fillStyle = `rgba(${b}, ${b - 5}, ${b - 10}, 0.35)`;
            ctx.fillRect(sx, sy, s * 0.1, s * 0.1);
        }

        // Edge fade
        this._drawEdgeFade(ctx, x, y, s, up, right, down, left, s * 0.45);
    }

    /**
     * Spice: reddish-orange streaks/patches on sand, like the original game.
     * In Dune II, spice appears as dense orange-brown brush strokes on sand.
     * Thick spice is a nearly solid orange-brown coverage.
     */
    _drawSpiceOverlay(ctx, x, y, s, isThick, up, right, down, left, hash) {
        // Base tint — warm orange wash
        const baseAlpha = isThick ? 0.55 : 0.3;
        ctx.fillStyle = `rgba(185, 95, 20, ${baseAlpha})`;
        ctx.fillRect(x, y, s, s);

        // Draw spice as streaky patches (horizontal brush strokes)
        const numStreaks = isThick ? 10 : 5;
        for (let i = 0; i < numStreaks; i++) {
            const sy = y + ((hash * (i + 1) * 13 + 7) % 100) / 100 * s;
            const sx = x + ((hash * (i + 1) * 7) % 60) / 100 * s;
            const sw = s * (0.3 + ((hash * (i + 3)) % 50) / 100 * 0.7);
            const sh = s * (0.06 + ((hash * (i + 5)) % 3) * 0.03);

            let alpha = isThick ? 0.65 : 0.45;
            // Fade near edges that don't have adjacent spice
            const edgeDist = s * 0.3;
            if (!up && (sy - y) < edgeDist) alpha *= (sy - y) / edgeDist;
            if (!down && (y + s - sy) < edgeDist) alpha *= (y + s - sy) / edgeDist;
            if (!left && (sx - x) < edgeDist) alpha *= (sx - x) / edgeDist;
            if (!right && (x + s - sx) < edgeDist) alpha *= Math.min(1, (x + s - sx) / edgeDist);
            if (alpha < 0.05) continue;

            const r = isThick ? 170 + (i * 7 % 25) : 190 + (i * 11 % 25);
            const g = isThick ? 70 + (i * 5 % 20) : 90 + (i * 7 % 25);
            ctx.fillStyle = `rgba(${r}, ${g}, 15, ${alpha})`;
            ctx.fillRect(sx, sy, sw, sh);
        }

        // Extra density dots for thick spice
        if (isThick) {
            for (let i = 0; i < 6; i++) {
                const dx = x + ((hash * (i + 11) * 19) % 100) / 100 * s;
                const dy = y + ((hash * (i + 13) * 23) % 100) / 100 * s;
                ctx.fillStyle = 'rgba(160, 75, 10, 0.5)';
                ctx.beginPath();
                ctx.arc(dx, dy, s * 0.06, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Shared edge fade helper — draws sand-colored gradients on edges
     * that face different terrain, plus radial corner fades to create
     * smooth organic rounded transitions like the original game.
     */
    _drawEdgeFade(ctx, x, y, s, up, right, down, left, fade) {
        const sandR = 180, sandG = 120, sandB = 55;
        const sandFull = `rgba(${sandR},${sandG},${sandB}, 0.95)`;
        const sandMid  = `rgba(${sandR},${sandG},${sandB}, 0.4)`;
        const sandZero = `rgba(${sandR},${sandG},${sandB}, 0)`;

        // Cardinal edge fades
        if (!up) {
            const g = ctx.createLinearGradient(x, y, x, y + fade);
            g.addColorStop(0, sandFull); g.addColorStop(0.5, sandMid); g.addColorStop(1, sandZero);
            ctx.fillStyle = g; ctx.fillRect(x, y, s, fade);
        }
        if (!down) {
            const g = ctx.createLinearGradient(x, y + s, x, y + s - fade);
            g.addColorStop(0, sandFull); g.addColorStop(0.5, sandMid); g.addColorStop(1, sandZero);
            ctx.fillStyle = g; ctx.fillRect(x, y + s - fade, s, fade);
        }
        if (!left) {
            const g = ctx.createLinearGradient(x, y, x + fade, y);
            g.addColorStop(0, sandFull); g.addColorStop(0.5, sandMid); g.addColorStop(1, sandZero);
            ctx.fillStyle = g; ctx.fillRect(x, y, fade, s);
        }
        if (!right) {
            const g = ctx.createLinearGradient(x + s, y, x + s - fade, y);
            g.addColorStop(0, sandFull); g.addColorStop(0.5, sandMid); g.addColorStop(1, sandZero);
            ctx.fillStyle = g; ctx.fillRect(x + s - fade, y, fade, s);
        }

        // Corner radial fades — rounds off the square corners where two edges meet
        const cornerR = fade * 1.1;
        const corners = [
            { cx: x,     cy: y,     hasU: !up, hasL: !left },      // top-left
            { cx: x + s, cy: y,     hasU: !up, hasR: !right },     // top-right
            { cx: x,     cy: y + s, hasD: !down, hasL: !left },    // bottom-left
            { cx: x + s, cy: y + s, hasD: !down, hasR: !right },   // bottom-right
        ];
        for (const c of corners) {
            const isExposedCorner = (c.hasU || c.hasD) && (c.hasL || c.hasR);
            if (isExposedCorner) {
                const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, cornerR);
                g.addColorStop(0, sandFull);
                g.addColorStop(0.4, sandMid);
                g.addColorStop(1, sandZero);
                ctx.fillStyle = g;
                ctx.fillRect(c.cx - cornerR, c.cy - cornerR, cornerR * 2, cornerR * 2);
            }
        }
    }

    /** Concrete: flat gray slab */
    _drawConcreteOverlay(ctx, x, y, s) {
        ctx.fillStyle = 'rgba(100, 100, 90, 0.5)';
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(120, 120, 110, 0.3)';
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }

    /** Wall: dark solid block */
    _drawWallOverlay(ctx, x, y, s) {
        ctx.fillStyle = 'rgba(60, 55, 50, 0.7)';
        ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(80, 75, 65, 0.5)';
        ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
    }

    /** Simple hash for deterministic per-tile variation */
    _tileHash(x, y) {
        return ((x * 2654435761 + y * 340573321) >>> 0) & 0xFF;
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
        // Structures use colored rectangles with house tinting (handled by Renderer)
        return false;
    }
}

// ============================================================
// Terrain categories
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
// Unit sprite mappings (unchanged)
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
