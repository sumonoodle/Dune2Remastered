import { TERRAIN, canGrowSpice } from '../data/terrain.js';

const MAP_SIZE = 64;

export class GameMap {
    constructor() {
        this.width = MAP_SIZE;
        this.height = MAP_SIZE;
        this.tiles = new Array(MAP_SIZE * MAP_SIZE);
        this.generate();
    }

    generate() {
        // Generate a Dune II-style desert map with Perlin-like noise
        const noise = this._generateNoise();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const i = y * this.width + x;
                const n = noise[i];

                let terrain;
                if (n < 0.15) {
                    terrain = TERRAIN.MOUNTAIN;
                } else if (n < 0.22) {
                    terrain = TERRAIN.PARTIAL_MOUNTAIN;
                } else if (n < 0.35) {
                    terrain = TERRAIN.ROCK;
                } else if (n < 0.42) {
                    terrain = TERRAIN.MOSTLY_ROCK;
                } else if (n < 0.48) {
                    terrain = TERRAIN.PARTIAL_ROCK;
                } else if (n < 0.72) {
                    terrain = TERRAIN.SAND;
                } else if (n < 0.80) {
                    terrain = TERRAIN.DUNE;
                } else if (n < 0.85) {
                    terrain = TERRAIN.PARTIAL_DUNE;
                } else if (n < 0.93) {
                    terrain = TERRAIN.SPICE;
                } else {
                    terrain = TERRAIN.THICK_SPICE;
                }

                this.tiles[i] = {
                    terrain,
                    spiceAmount: terrain === TERRAIN.THICK_SPICE ? 8 :
                                 terrain === TERRAIN.SPICE ? 4 : 0,
                    structureId: null,
                    unitId: null,
                    visible: true  // fog of war (Phase 3)
                };
            }
        }

        // Ensure buildable rock areas for bases (top-left and bottom-right corners)
        this._createRockPatch(8, 8, 10);   // Player base area
        this._createRockPatch(52, 52, 10);  // Enemy base area
        this._createRockPatch(50, 10, 6);   // Extra rock area
        this._createRockPatch(10, 50, 6);   // Extra rock area

        // Place spice fields near bases so harvesters have something to gather
        this._createSpicePatch(20, 8, 5);   // Near player base
        this._createSpicePatch(15, 15, 4);  // Near player base
        this._createSpicePatch(44, 52, 5);  // Near enemy base
        this._createSpicePatch(48, 45, 4);  // Near enemy base
        // Mid-map spice fields
        this._createSpicePatch(32, 32, 6);
        this._createSpicePatch(25, 40, 4);
        this._createSpicePatch(40, 25, 4);
    }

    _createSpicePatch(cx, cy, radius) {
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
                    tile.spiceAmount = 8;
                } else if (dist < radius * 0.8) {
                    tile.terrain = TERRAIN.SPICE;
                    tile.spiceAmount = 4;
                }
            }
        }
    }

    _createRockPatch(cx, cy, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;

                const i = y * this.width + x;
                if (dist < radius * 0.5) {
                    this.tiles[i].terrain = TERRAIN.ROCK;
                } else if (dist < radius * 0.75) {
                    this.tiles[i].terrain = TERRAIN.MOSTLY_ROCK;
                } else if (dist < radius) {
                    this.tiles[i].terrain = Math.random() < 0.5 ?
                        TERRAIN.PARTIAL_ROCK : TERRAIN.MOSTLY_ROCK;
                }
                this.tiles[i].spiceAmount = 0;
            }
        }
    }

    _generateNoise() {
        // Simple value noise with smoothing for terrain generation
        const size = this.width * this.height;
        const raw = new Float32Array(size);
        const result = new Float32Array(size);

        // Multi-octave noise
        const octaves = [
            { scale: 8, weight: 0.5 },
            { scale: 16, weight: 0.3 },
            { scale: 32, weight: 0.2 }
        ];

        for (const { scale, weight } of octaves) {
            // Generate grid points
            const gridW = Math.ceil(this.width / scale) + 2;
            const gridH = Math.ceil(this.height / scale) + 2;
            const grid = new Float32Array(gridW * gridH);
            for (let i = 0; i < grid.length; i++) {
                grid[i] = Math.random();
            }

            // Bilinear interpolation
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const gx = x / scale;
                    const gy = y / scale;
                    const ix = Math.floor(gx);
                    const iy = Math.floor(gy);
                    const fx = gx - ix;
                    const fy = gy - iy;

                    const v00 = grid[iy * gridW + ix];
                    const v10 = grid[iy * gridW + ix + 1];
                    const v01 = grid[(iy + 1) * gridW + ix];
                    const v11 = grid[(iy + 1) * gridW + ix + 1];

                    const v0 = v00 + (v10 - v00) * fx;
                    const v1 = v01 + (v11 - v01) * fx;
                    const v = v0 + (v1 - v0) * fy;

                    raw[y * this.width + x] += v * weight;
                }
            }
        }

        // Normalize to 0-1
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < size; i++) {
            if (raw[i] < min) min = raw[i];
            if (raw[i] > max) max = raw[i];
        }
        const range = max - min || 1;
        for (let i = 0; i < size; i++) {
            result[i] = (raw[i] - min) / range;
        }

        return result;
    }

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
        if (tile) tile.terrain = terrain;
    }

    harvestSpice(x, y, amount) {
        const tile = this.getTile(x, y);
        if (!tile || tile.spiceAmount <= 0) return 0;

        const harvested = Math.min(amount, tile.spiceAmount);
        tile.spiceAmount -= harvested;

        if (tile.spiceAmount <= 0) {
            tile.spiceAmount = 0;
            tile.terrain = TERRAIN.SAND;
        } else if (tile.spiceAmount <= 4 && tile.terrain === TERRAIN.THICK_SPICE) {
            tile.terrain = TERRAIN.SPICE;
        }

        return harvested;
    }

    growSpice(tickCount) {
        // Spice regrowth every ~200 ticks
        if (tickCount % 200 !== 0) return;

        // Random spice growth near existing spice
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            const tile = this.getTile(x, y);
            if (!tile) continue;

            if (tile.terrain === TERRAIN.SPICE) {
                // Chance to become thick spice
                if (Math.random() < 0.3) {
                    tile.terrain = TERRAIN.THICK_SPICE;
                    tile.spiceAmount = 8;
                }
            } else if (canGrowSpice(tile.terrain) && tile.terrain !== TERRAIN.SPICE) {
                // Check if adjacent to spice
                const neighbors = [
                    this.getTile(x - 1, y), this.getTile(x + 1, y),
                    this.getTile(x, y - 1), this.getTile(x, y + 1)
                ];
                const hasAdjacentSpice = neighbors.some(n =>
                    n && (n.terrain === TERRAIN.SPICE || n.terrain === TERRAIN.THICK_SPICE)
                );
                if (hasAdjacentSpice && Math.random() < 0.2) {
                    tile.terrain = TERRAIN.SPICE;
                    tile.spiceAmount = 4;
                }
            }
        }
    }

    isPassable(x, y, movementType) {
        const tile = this.getTile(x, y);
        if (!tile) return false;

        const terrain = tile.terrain;
        // Mountains and walls are impassable for ground units
        if (terrain === TERRAIN.MOUNTAIN || terrain === TERRAIN.WALL) {
            return movementType === 4; // Only air units
        }
        if (terrain === TERRAIN.STRUCTURE) {
            return movementType === 4;
        }
        if (terrain === TERRAIN.PARTIAL_MOUNTAIN) {
            return movementType === 0 || movementType === 4; // Foot and air only
        }
        return true;
    }
}
