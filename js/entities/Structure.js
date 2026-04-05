import { STRUCTURE_DATA, STRUCTURE_TYPE } from '../data/structures.js';
import { TERRAIN } from '../data/terrain.js';
import { canBuildOn } from '../data/terrain.js';

let nextStructureId = 1;

export class Structure {
    constructor(type, tileX, tileY, houseId) {
        this.id = nextStructureId++;
        this.type = type;
        this.data = STRUCTURE_DATA[type];
        this.houseId = houseId;

        this.x = tileX;
        this.y = tileY;
        this.hp = this.data.hitpoints;
        this.maxHp = this.data.hitpoints;
        this.selected = false;
        this.alive = true;

        // Build queue (Phase 3 feature, stub here)
        this.buildQueue = [];
        this.buildProgress = 0;
        this.building = false;

        // Rally point
        this.rallyX = null;
        this.rallyY = null;

        // Turret combat
        this.attackCooldown = 0;
        this.attackTarget = null;
    }

    update(dt, game) {
        if (!this.alive) return;

        // Process build queue
        if (this.buildQueue.length > 0 && this.building) {
            this.buildProgress += dt;
            const buildItem = this.buildQueue[0];
            if (this.buildProgress >= buildItem.buildTime) {
                this._completeBuild(game, buildItem);
                this.buildQueue.shift();
                this.buildProgress = 0;
                this.building = this.buildQueue.length > 0;
            }
        }

        // Turret auto-attack
        if (this.data.weaponRange && this.data.damage) {
            this._updateTurretCombat(dt, game);
        }
    }

    _updateTurretCombat(dt, game) {
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        const cx = this.x + this.data.tileWidth / 2;
        const cy = this.y + this.data.tileHeight / 2;
        const range = this.data.weaponRange;

        // Check if current target is still valid
        if (this.attackTarget) {
            if (!this.attackTarget.alive || !this.attackTarget.visible) {
                this.attackTarget = null;
            } else {
                const dx = this.attackTarget.x - cx;
                const dy = this.attackTarget.y - cy;
                if (Math.sqrt(dx * dx + dy * dy) > range + 1) {
                    this.attackTarget = null;
                }
            }
        }

        // Find new target if needed
        if (!this.attackTarget) {
            let bestDist = range + 1;
            for (const unit of game.units) {
                if (!unit.alive || !unit.visible || unit.houseId === this.houseId) continue;
                const dx = unit.x - cx;
                const dy = unit.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    this.attackTarget = unit;
                }
            }
        }

        // Fire at target
        if (this.attackTarget && this.attackCooldown <= 0) {
            this.attackTarget.takeDamage(this.data.damage);
            this.attackCooldown = 2.0; // Fire every 2 seconds
            // Add projectile visual (stored on game for renderer)
            if (!game.projectiles) game.projectiles = [];
            game.projectiles.push({
                x1: cx, y1: cy,
                x2: this.attackTarget.x, y2: this.attackTarget.y,
                timer: 0.15
            });
        }
    }

    _completeBuild(game, buildItem) {
        // Spawn the unit near the structure
        const spawnX = this.x + this.data.tileWidth;
        const spawnY = this.y + Math.floor(this.data.tileHeight / 2);
        const unit = game.createUnit(buildItem.unitType, spawnX, spawnY, this.houseId);

        // Auto-move to rally point if set
        if (this.rallyX !== null && this.rallyY !== null && unit) {
            unit.moveTo(this.rallyX, this.rallyY, game);
        }
    }

    queueUnit(unitType, buildTime) {
        this.buildQueue.push({ unitType, buildTime });
        if (!this.building) {
            this.building = true;
            this.buildProgress = 0;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }

    occupiesTile(tx, ty) {
        return tx >= this.x && tx < this.x + this.data.tileWidth &&
               ty >= this.y && ty < this.y + this.data.tileHeight;
    }

    getCenterWorld() {
        return {
            x: (this.x + this.data.tileWidth / 2),
            y: (this.y + this.data.tileHeight / 2)
        };
    }

    static canPlace(map, type, tileX, tileY, structures, houseId) {
        const data = STRUCTURE_DATA[type];
        if (!data) return false;

        for (let dy = 0; dy < data.tileHeight; dy++) {
            for (let dx = 0; dx < data.tileWidth; dx++) {
                const tx = tileX + dx;
                const ty = tileY + dy;
                const tile = map.getTile(tx, ty);
                if (!tile) return false;

                // Must build on rock or concrete
                if (!canBuildOn(tile.terrain) && tile.terrain !== TERRAIN.CONCRETE) {
                    return false;
                }

                // Check for overlapping structures
                for (const s of structures) {
                    if (s.alive && s.occupiesTile(tx, ty)) return false;
                }
            }
        }

        // Concrete slabs and walls don't need adjacency
        if (type === STRUCTURE_TYPE.CONCRETE || type === STRUCTURE_TYPE.CONCRETE4 ||
            type === STRUCTURE_TYPE.WALL) {
            return true;
        }

        // Must be adjacent to an existing friendly structure
        if (structures.some(s => s.alive && (houseId === undefined || s.houseId === houseId))) {
            let adjacent = false;
            for (let dy = -1; dy <= data.tileHeight && !adjacent; dy++) {
                for (let dx = -1; dx <= data.tileWidth && !adjacent; dx++) {
                    // Only check border tiles (not interior)
                    if (dy >= 0 && dy < data.tileHeight && dx >= 0 && dx < data.tileWidth) continue;
                    const checkX = tileX + dx;
                    const checkY = tileY + dy;
                    for (const s of structures) {
                        if (s.alive && (houseId === undefined || s.houseId === houseId) &&
                            s.occupiesTile(checkX, checkY)) {
                            adjacent = true;
                            break;
                        }
                    }
                }
            }
            if (!adjacent) return false;
        }

        return true;
    }
}
