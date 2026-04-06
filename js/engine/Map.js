/**
 * GameMap - Dune II map generation and terrain management
 *
 * Faithfully ports the terrain generation pipeline from OpenDUNE src/map.c
 * Map_CreateLandscape(). The pipeline:
 *
 * 1. Place random values on a 16x16 grid
 * 2. Bilinear interpolation to fill the 64x64 map
 * 3. Average with neighbors to smooth
 * 4. Threshold into landscape types (sand, rock, dune, mountain)
 * 5. Add spice patches on compatible terrain
 * 6. Compute autotile indices based on 4-neighbor masks
 * 7. Map autotile indices to ICN sprite IDs via the landscape group
 *
 * Each tile stores both the gameplay terrain type (TERRAIN enum) and
 * the visual sprite ID (ICN tile index) for rendering.
 */

import { TERRAIN, canGrowSpice } from '../data/terrain.js';
import { LST, lstToTerrain, computeAutotileIndex, autotileToSpriteID } from './SpriteManager.js';

const MAP_SIZE = 64;

export class GameMap {
    constructor() {
        this.width = MAP_SIZE;
        this.height = MAP_SIZE;
        this.tiles = new Array(MAP_SIZE * MAP_SIZE);
        this.generate();
    }

    generate() {
        // ========================================
        // Phase 1: Generate raw landscape values
        // Port of OpenDUNE Map_CreateLandscape()
        // ========================================

        const seed = Math.floor(Math.random() * 0xFFFFFFFF);
        this._rngState = seed;

        // Temporary array holding landscape type values per tile
        const landscape = new Uint16Array(MAP_SIZE * MAP_SIZE);

        // Step 1: Place random data on a 16x16 grid (stored at every 4th position)
        const memory = new Uint8Array(273);
        for (let i = 0; i < 272; i++) {
            memory[i] = this._random256() & 0xF;
            if (memory[i] > 0xA) memory[i] = 0xA;
        }

        // Add some random peaks
        const around = [0, -1, 1, -16, 16, -17, 17, -15, 15, -2, 2, -32, 32, -4, 4, -64, 64, -30, 30, -34, 34];

        let numPeaks = (this._random256() & 0xF) + 1;
        while (numPeaks-- > 0) {
            const base = this._random256();
            for (const offset of around) {
                const index = Math.min(Math.max(0, base + offset), 272);
                memory[index] = (memory[index] + (this._random256() & 0xF)) & 0xF;
            }
        }

        // Add some random valleys
        let numValleys = (this._random256() & 0x3) + 1;
        while (numValleys-- > 0) {
            const base = this._random256();
            for (const offset of around) {
                const index = Math.min(Math.max(0, base + offset), 272);
                memory[index] = this._random256() & 0x3;
            }
        }

        // Place grid values at every 4th tile
        for (let j = 0; j < 16; j++) {
            for (let i = 0; i < 16; i++) {
                landscape[j * 4 * MAP_SIZE + i * 4] = memory[j * 16 + i];
            }
        }

        // Step 2: Bilinear interpolation between grid points
        // Using offset tables from OpenDUNE _offsetTable
        const offsetTable = [
            [[0,0,4,0],[4,0,4,4],[0,0,0,4],[0,4,4,4],[0,0,0,2],
             [0,2,0,4],[0,0,2,0],[2,0,4,0],[4,0,4,2],[4,2,4,4],
             [0,4,2,4],[2,4,4,4],[0,0,4,4],[2,0,2,2],[0,0,2,2],
             [4,0,2,2],[0,2,2,2],[2,2,4,2],[2,2,0,4],[2,2,4,4],
             [2,2,2,4]],
            [[0,0,4,0],[4,0,4,4],[0,0,0,4],[0,4,4,4],[0,0,0,2],
             [0,2,0,4],[0,0,2,0],[2,0,4,0],[4,0,4,2],[4,2,4,4],
             [0,4,2,4],[2,4,4,4],[4,0,0,4],[2,0,2,2],[0,0,2,2],
             [4,0,2,2],[0,2,2,2],[2,2,4,2],[2,2,0,4],[2,2,4,4],
             [2,2,2,4]]
        ];

        for (let j = 0; j < 16; j++) {
            for (let i = 0; i < 16; i++) {
                const table = offsetTable[(i + 1) % 2];
                for (let k = 0; k < 21; k++) {
                    const offsets = table[k];
                    const x1 = (i * 4 + offsets[0]) & 0x3F;
                    const y1 = j * 4 + offsets[1];
                    const x2 = (i * 4 + offsets[2]) & 0x3F;
                    const y2 = j * 4 + offsets[3];

                    const packed1 = y1 * MAP_SIZE + x1;
                    const packed2 = y2 * MAP_SIZE + x2;
                    const packedMid = Math.floor((y1 * MAP_SIZE + (i * 4 + offsets[0]) +
                                                   y2 * MAP_SIZE + (i * 4 + offsets[2])) / 2);

                    if (packedMid < 0 || packedMid >= MAP_SIZE * MAP_SIZE) continue;
                    if (packed1 < 0 || packed1 >= MAP_SIZE * MAP_SIZE) continue;

                    const sprite2 = (packed2 >= 0 && packed2 < MAP_SIZE * MAP_SIZE)
                        ? landscape[packed2] : 0;

                    landscape[packedMid] = Math.floor((landscape[packed1] + sprite2 + 1) / 2);
                }
            }
        }

        // Step 3: Average each tile with its 9 neighbors
        const currentRow = new Uint16Array(MAP_SIZE);
        const previousRow = new Uint16Array(MAP_SIZE);

        for (let j = 0; j < MAP_SIZE; j++) {
            // Copy current row
            previousRow.set(currentRow);
            for (let i = 0; i < MAP_SIZE; i++) {
                currentRow[i] = landscape[j * MAP_SIZE + i];
            }

            for (let i = 0; i < MAP_SIZE; i++) {
                const c = currentRow[i];
                const neighbours = [
                    (i === 0  || j === 0)  ? c : previousRow[i - 1],
                    (j === 0)              ? c : previousRow[i],
                    (i === 63 || j === 0)  ? c : previousRow[i + 1],
                    (i === 0)              ? c : currentRow[i - 1],
                    c,
                    (i === 63)             ? c : currentRow[i + 1],
                    (i === 0  || j === 63) ? c : landscape[(j + 1) * MAP_SIZE + i - 1],
                    (j === 63)             ? c : landscape[(j + 1) * MAP_SIZE + i],
                    (i === 63 || j === 63) ? c : landscape[(j + 1) * MAP_SIZE + i + 1],
                ];

                let total = 0;
                for (let k = 0; k < 9; k++) total += neighbours[k];
                landscape[j * MAP_SIZE + i] = Math.floor(total / 9);
            }
        }

        // ========================================
        // Phase 2: Threshold into landscape types
        // ========================================

        // Random thresholds (from OpenDUNE)
        let spriteID1 = this._random256() & 0xF;
        if (spriteID1 < 0x8) spriteID1 = 0x8;
        if (spriteID1 > 0xC) spriteID1 = 0xC;

        let spriteID2 = (this._random256() & 0x3) - 1;
        if (spriteID2 > spriteID1 - 3) spriteID2 = spriteID1 - 3;

        for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
            const v = landscape[i];
            if (v > spriteID1 + 4) {
                landscape[i] = LST.ENTIRELY_MOUNTAIN;
            } else if (v >= spriteID1) {
                landscape[i] = LST.ENTIRELY_ROCK;
            } else if (v <= spriteID2) {
                landscape[i] = LST.ENTIRELY_DUNE;
            } else {
                landscape[i] = LST.NORMAL_SAND;
            }
        }

        // ========================================
        // Phase 3: Add spice patches
        // ========================================
        const canBecomeSpice = [
            true,  // LST_NORMAL_SAND
            false, // LST_PARTIAL_ROCK
            true,  // LST_ENTIRELY_DUNE
            true,  // LST_PARTIAL_DUNE
            false, // LST_ENTIRELY_ROCK
            false, // LST_MOSTLY_ROCK
            false, // LST_ENTIRELY_MOUNTAIN
            false, // LST_PARTIAL_MOUNTAIN
            true,  // LST_SPICE
            true,  // LST_THICK_SPICE
            false, // LST_CONCRETE_SLAB
            false, // LST_WALL
            false, // LST_STRUCTURE
            false, // LST_DESTROYED_WALL
            true,  // LST_BLOOM_FIELD
        ];

        let numSpiceFields = this._random256() & 0x2F;
        while (numSpiceFields-- > 0) {
            // Find a random sand/dune tile to place spice center
            let packed;
            let attempts = 100;
            while (attempts-- > 0) {
                const x = this._random256() & 0x3F;
                const y = this._random256() & 0x3F;
                packed = y * MAP_SIZE + x;
                if (canBecomeSpice[landscape[packed]]) break;
            }
            if (attempts <= 0) continue;

            const cx = packed % MAP_SIZE;
            const cy = Math.floor(packed / MAP_SIZE);

            // Spread spice around the center point
            let numSpots = this._random256() & 0x1F;
            while (numSpots-- > 0) {
                // Random walk from center
                const angle = Math.random() * Math.PI * 2;
                const dist = (this._random256() & 0x3F) * 0.15;
                const tx = Math.round(cx + Math.cos(angle) * dist);
                const ty = Math.round(cy + Math.sin(angle) * dist);

                if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) continue;

                const tileIdx = ty * MAP_SIZE + tx;
                const lst = landscape[tileIdx];

                if (!canBecomeSpice[lst]) continue;

                if (lst === LST.THICK_SPICE) continue;
                if (lst === LST.SPICE) {
                    // Check if we can upgrade to thick spice
                    // Only if surrounded by compatible terrain
                    let canUpgrade = true;
                    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
                        const nx = tx + dx, ny = ty + dy;
                        if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
                        const nLst = landscape[ny * MAP_SIZE + nx];
                        if (!canBecomeSpice[nLst]) {
                            canUpgrade = false;
                            break;
                        }
                    }
                    if (canUpgrade) {
                        landscape[tileIdx] = LST.THICK_SPICE;
                    }
                    continue;
                }

                landscape[tileIdx] = LST.SPICE;
            }
        }

        // ========================================
        // Phase 4: Compute autotile indices
        // Port of OpenDUNE lines 1603-1656
        // ========================================

        // Reset row buffers
        currentRow.fill(0);
        previousRow.fill(0);

        for (let j = 0; j < MAP_SIZE; j++) {
            previousRow.set(currentRow);
            for (let i = 0; i < MAP_SIZE; i++) {
                currentRow[i] = landscape[j * MAP_SIZE + i];
            }

            for (let i = 0; i < MAP_SIZE; i++) {
                const current = landscape[j * MAP_SIZE + i];
                const up    = (j === 0)  ? current : previousRow[i];
                const right = (i === 63) ? current : currentRow[i + 1];
                const down  = (j === 63) ? current : landscape[(j + 1) * MAP_SIZE + i];
                const left  = (i === 0)  ? current : currentRow[i - 1];

                landscape[j * MAP_SIZE + i] = computeAutotileIndex(current, up, right, down, left);
            }
        }

        // ========================================
        // Phase 5: Convert autotile indices to sprite IDs
        // and create the final tile data
        // ========================================

        // We need a second pass to determine the gameplay terrain type,
        // so we also store the original landscape type before autotiling.
        // Reconstruct it from the autotile index ranges.
        for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
            const autotileIdx = landscape[i];
            const spriteID = autotileToSpriteID(autotileIdx);

            // Determine gameplay terrain from autotile index range
            let terrain;
            let spiceAmount = 0;
            if (autotileIdx === 0) {
                terrain = TERRAIN.SAND;
            } else if (autotileIdx <= 16) {
                terrain = TERRAIN.ROCK;
            } else if (autotileIdx <= 32) {
                terrain = TERRAIN.DUNE;
            } else if (autotileIdx <= 48) {
                terrain = TERRAIN.MOUNTAIN;
            } else if (autotileIdx <= 64) {
                terrain = TERRAIN.SPICE;
                spiceAmount = 20;
            } else {
                terrain = TERRAIN.THICK_SPICE;
                spiceAmount = 40;
            }

            this.tiles[i] = {
                terrain,
                spriteID,           // ICN tile index for rendering
                autotileIndex: autotileIdx,
                spiceAmount,
                structureId: null,
                unitId: null,
                visible: true       // fog of war (Phase 3)
            };
        }

        // ========================================
        // Phase 6: Ensure buildable rock areas for bases
        // ========================================
        this._ensureRockPatch(8, 8, 10);    // Player base area
        this._ensureRockPatch(52, 52, 10);   // Enemy base area
        this._ensureRockPatch(50, 10, 6);    // Extra rock
        this._ensureRockPatch(10, 50, 6);    // Extra rock

        // Re-run autotiling for affected areas
        this._recomputeSprites();

        // Add spice near bases if there isn't enough
        this._ensureSpicePatch(20, 8, 5);
        this._ensureSpicePatch(44, 52, 5);
        this._ensureSpicePatch(32, 32, 6);
        this._recomputeSprites();
    }

    /**
     * Ensure a circular rock area exists at (cx, cy) for base placement.
     */
    _ensureRockPatch(cx, cy, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;

                const i = y * this.width + x;
                const tile = this.tiles[i];

                if (dist < radius * 0.5) {
                    tile.terrain = TERRAIN.ROCK;
                    tile.spiceAmount = 0;
                } else if (dist < radius * 0.75) {
                    tile.terrain = TERRAIN.ROCK;
                    tile.spiceAmount = 0;
                }
                // Leave edges as whatever they are — autotiling will handle transitions
            }
        }
    }

    /**
     * Ensure spice exists near the given center.
     */
    _ensureSpicePatch(cx, cy, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;

                const i = y * this.width + x;
                const tile = this.tiles[i];

                // Don't overwrite rock or mountains
                if (tile.terrain === TERRAIN.ROCK || tile.terrain === TERRAIN.MOSTLY_ROCK ||
                    tile.terrain === TERRAIN.MOUNTAIN || tile.terrain === TERRAIN.PARTIAL_MOUNTAIN) continue;

                if (dist < radius * 0.4) {
                    tile.terrain = TERRAIN.THICK_SPICE;
                    tile.spiceAmount = 40;
                } else if (dist < radius * 0.8) {
                    tile.terrain = TERRAIN.SPICE;
                    tile.spiceAmount = 20;
                }
            }
        }
    }

    /**
     * Recompute autotile sprite IDs for all tiles.
     * Called after modifying terrain (e.g., placing base rock patches).
     */
    _recomputeSprites() {
        for (let j = 0; j < MAP_SIZE; j++) {
            for (let i = 0; i < MAP_SIZE; i++) {
                const idx = j * MAP_SIZE + i;
                const tile = this.tiles[idx];
                const lst = terrainToLst(tile.terrain);

                const up    = (j === 0)  ? lst : terrainToLst(this.tiles[(j - 1) * MAP_SIZE + i].terrain);
                const right = (i === 63) ? lst : terrainToLst(this.tiles[j * MAP_SIZE + i + 1].terrain);
                const down  = (j === 63) ? lst : terrainToLst(this.tiles[(j + 1) * MAP_SIZE + i].terrain);
                const left  = (i === 0)  ? lst : terrainToLst(this.tiles[j * MAP_SIZE + i - 1].terrain);

                const autotileIdx = computeAutotileIndex(lst, up, right, down, left);
                tile.spriteID = autotileToSpriteID(autotileIdx);
                tile.autotileIndex = autotileIdx;
            }
        }
    }

    // ========================================
    // Simple seeded RNG (matching OpenDUNE's Tools_Random_256)
    // ========================================
    _random256() {
        // LCG — good enough for terrain generation
        this._rngState = (this._rngState * 1103515245 + 12345) & 0x7FFFFFFF;
        return (this._rngState >> 16) & 0xFF;
    }

    // ========================================
    // Public API (unchanged interface)
    // ========================================

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.tiles[y * this.width + x];
    }

    getTerrain(x, y) {
        const tile = this.getTile(x, y);
        return tile ? tile.terrain : TERRAIN.MOUNTAIN;
    }

    setTerrain(x, y, terrain) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.terrain = terrain;
            // Recompute this tile and its neighbors' sprites
            this._recomputeTileSprite(x, y);
            this._recomputeTileSprite(x - 1, y);
            this._recomputeTileSprite(x + 1, y);
            this._recomputeTileSprite(x, y - 1);
            this._recomputeTileSprite(x, y + 1);
        }
    }

    _recomputeTileSprite(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = y * this.width + x;
        const tile = this.tiles[idx];
        const lst = terrainToLst(tile.terrain);

        const up    = (y === 0)             ? lst : terrainToLst(this.tiles[(y - 1) * this.width + x].terrain);
        const right = (x === this.width - 1) ? lst : terrainToLst(this.tiles[y * this.width + x + 1].terrain);
        const down  = (y === this.height - 1) ? lst : terrainToLst(this.tiles[(y + 1) * this.width + x].terrain);
        const left  = (x === 0)              ? lst : terrainToLst(this.tiles[y * this.width + x - 1].terrain);

        tile.autotileIndex = computeAutotileIndex(lst, up, right, down, left);
        tile.spriteID = autotileToSpriteID(tile.autotileIndex);
    }

    harvestSpice(x, y, amount) {
        const tile = this.getTile(x, y);
        if (!tile || tile.spiceAmount <= 0) return 0;

        const harvested = Math.min(amount, tile.spiceAmount);
        tile.spiceAmount -= harvested;

        if (tile.spiceAmount <= 0) {
            tile.spiceAmount = 0;
            this.setTerrain(x, y, TERRAIN.SAND);
        } else if (tile.spiceAmount <= 20 && tile.terrain === TERRAIN.THICK_SPICE) {
            this.setTerrain(x, y, TERRAIN.SPICE);
        }

        return harvested;
    }

    growSpice(tickCount) {
        if (tickCount % 200 !== 0) return;

        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            const tile = this.getTile(x, y);
            if (!tile) continue;

            if (tile.terrain === TERRAIN.SPICE) {
                if (Math.random() < 0.3) {
                    this.setTerrain(x, y, TERRAIN.THICK_SPICE);
                    tile.spiceAmount = 40;
                }
            } else if (canGrowSpice(tile.terrain) && tile.terrain !== TERRAIN.SPICE) {
                const neighbors = [
                    this.getTile(x - 1, y), this.getTile(x + 1, y),
                    this.getTile(x, y - 1), this.getTile(x, y + 1)
                ];
                const hasAdjacentSpice = neighbors.some(n =>
                    n && (n.terrain === TERRAIN.SPICE || n.terrain === TERRAIN.THICK_SPICE)
                );
                if (hasAdjacentSpice && Math.random() < 0.2) {
                    this.setTerrain(x, y, TERRAIN.SPICE);
                    tile.spiceAmount = 20;
                }
            }
        }
    }

    isPassable(x, y, movementType) {
        const tile = this.getTile(x, y);
        if (!tile) return false;

        const terrain = tile.terrain;
        if (terrain === TERRAIN.MOUNTAIN || terrain === TERRAIN.WALL) {
            return movementType === 4; // Air units only
        }
        if (terrain === TERRAIN.STRUCTURE) {
            return movementType === 4;
        }
        if (terrain === TERRAIN.PARTIAL_MOUNTAIN) {
            return movementType === 0 || movementType === 4; // Foot and air
        }
        return true;
    }
}

/**
 * Convert TERRAIN enum back to LST for autotile computation.
 */
function terrainToLst(terrain) {
    switch (terrain) {
        case TERRAIN.SAND:              return LST.NORMAL_SAND;
        case TERRAIN.PARTIAL_ROCK:      return LST.PARTIAL_ROCK;
        case TERRAIN.DUNE:              return LST.ENTIRELY_DUNE;
        case TERRAIN.PARTIAL_DUNE:      return LST.PARTIAL_DUNE;
        case TERRAIN.ROCK:              return LST.ENTIRELY_ROCK;
        case TERRAIN.MOSTLY_ROCK:       return LST.MOSTLY_ROCK;
        case TERRAIN.MOUNTAIN:          return LST.ENTIRELY_MOUNTAIN;
        case TERRAIN.PARTIAL_MOUNTAIN:  return LST.PARTIAL_MOUNTAIN;
        case TERRAIN.SPICE:             return LST.SPICE;
        case TERRAIN.THICK_SPICE:       return LST.THICK_SPICE;
        case TERRAIN.CONCRETE:          return LST.CONCRETE_SLAB;
        case TERRAIN.WALL:              return LST.WALL;
        case TERRAIN.STRUCTURE:         return LST.STRUCTURE;
        case TERRAIN.DESTROYED_WALL:    return LST.DESTROYED_WALL;
        case TERRAIN.BLOOM:             return LST.BLOOM_FIELD;
        default:                        return LST.NORMAL_SAND;
    }
}
