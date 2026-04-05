import { UNIT_DATA, UNIT_TYPE } from '../data/units.js';
import { TERRAIN } from '../data/terrain.js';

const TILE_SIZE = 32;

let nextUnitId = 1;

export class Unit {
    constructor(type, x, y, houseId) {
        this.id = nextUnitId++;
        this.type = type;
        this.data = UNIT_DATA[type];
        this.houseId = houseId;

        // Position in tile coordinates (center of tile)
        this.x = x + 0.5;
        this.y = y + 0.5;

        this.hp = this.data.hitpoints;
        this.maxHp = this.data.hitpoints;
        this.selected = false;

        // Movement
        this.path = null;
        this.pathIndex = 0;
        this.targetX = this.x;
        this.targetY = this.y;
        this.moveSpeed = Math.max(1.5, this.data.speed * 0.06); // tiles per second

        // Harvester-specific
        this.spiceCarried = 0;
        this.spiceCapacity = this.data.spiceCapacity || 0;
        this.harvesterState = 'idle'; // idle, seeking, harvesting, returning, depositing
        this.harvestTimer = 0;
        this.assignedRefinery = null;

        // Carryall-specific
        this.carryingUnit = null;
        this.carryallState = 'idle'; // idle, pickup, delivering
        this.carryallTarget = null;

        // Combat
        this.attackTarget = null;
        this.attackCooldown = 0;

        // State
        this.state = 'idle'; // idle, moving, attacking, harvesting
        this.alive = true;
    }

    update(dt, game) {
        if (!this.alive) return;

        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        switch (this.type) {
            case UNIT_TYPE.HARVESTER:
                this._updateHarvester(dt, game);
                break;
            case UNIT_TYPE.CARRYALL:
                this._updateCarryall(dt, game);
                break;
            default:
                this._updateCombatUnit(dt, game);
                break;
        }

        this._updateMovement(dt);
    }

    _updateMovement(dt) {
        if (!this.path || this.pathIndex >= this.path.length) {
            this.path = null;
            return;
        }

        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.05) {
            this.x = target.x;
            this.y = target.y;
            this.pathIndex++;
            if (this.pathIndex >= this.path.length) {
                this.path = null;
                if (this.state === 'moving') this.state = 'idle';
            }
            return;
        }

        const speed = this.moveSpeed * dt;
        const move = Math.min(speed, dist);
        this.x += (dx / dist) * move;
        this.y += (dy / dist) * move;
    }

    _updateHarvester(dt, game) {
        switch (this.harvesterState) {
            case 'manual':
                // Player issued a direct move command - don't auto-harvest
                if (!this.path || this.pathIndex >= (this.path?.length || 0)) {
                    this.harvesterState = 'idle';
                }
                break;

            case 'idle':
                if (this.spiceCarried > 0) {
                    this._returnToRefinery(game);
                } else {
                    this._seekSpice(game);
                }
                break;

            case 'seeking':
                if (!this.path || this.pathIndex >= (this.path?.length || 0)) {
                    // Arrived at spice location, start harvesting
                    const tx = Math.floor(this.x);
                    const ty = Math.floor(this.y);
                    const tile = game.map.getTile(tx, ty);
                    if (tile && (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE)) {
                        this.harvesterState = 'harvesting';
                        this.harvestTimer = 0;
                    } else {
                        this._seekSpice(game);
                    }
                }
                break;

            case 'harvesting':
                this.harvestTimer += dt;
                if (this.harvestTimer >= 0.5) {
                    this.harvestTimer = 0;
                    const tx = Math.floor(this.x);
                    const ty = Math.floor(this.y);
                    const harvested = game.map.harvestSpice(tx, ty, 50);
                    this.spiceCarried += harvested;

                    if (this.spiceCarried >= this.spiceCapacity || harvested === 0) {
                        this._returnToRefinery(game);
                    } else if (harvested === 0) {
                        this._seekSpice(game);
                    }
                }
                break;

            case 'returning':
                if (!this.path || this.pathIndex >= (this.path?.length || 0)) {
                    this.harvesterState = 'depositing';
                    this.harvestTimer = 0;
                }
                break;

            case 'depositing':
                this.harvestTimer += dt;
                if (this.harvestTimer >= 1.0) {
                    // Deposit spice as credits
                    const creditsPerSpice = 7;
                    game.addCredits(this.houseId, this.spiceCarried * creditsPerSpice);
                    this.spiceCarried = 0;
                    this.harvesterState = 'idle';
                }
                break;
        }
    }

    _seekSpice(game) {
        this.harvesterState = 'seeking';
        this.state = 'moving';

        // Find nearest reachable spice tile
        const tx = Math.floor(this.x);
        const ty = Math.floor(this.y);
        const candidates = [];

        // Collect spice candidates in expanding rings
        for (let r = 0; r < 30; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const sx = tx + dx;
                    const sy = ty + dy;
                    const tile = game.map.getTile(sx, sy);
                    if (tile && (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE)) {
                        candidates.push({ x: sx, y: sy, dist: Math.abs(dx) + Math.abs(dy) });
                    }
                }
            }
            if (candidates.length > 0) break;
        }

        // Sort by distance and try to pathfind to each
        candidates.sort((a, b) => a.dist - b.dist);
        for (const c of candidates.slice(0, 5)) {
            const path = game.pathfinding.findPath(
                this.x, this.y, c.x + 0.5, c.y + 0.5, this.data.movementType
            );
            if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                return;
            }
        }

        // No reachable spice found
        this.harvesterState = 'idle';
        this.state = 'idle';
    }

    _returnToRefinery(game) {
        this.harvesterState = 'returning';
        this.state = 'moving';

        // Find nearest refinery
        const refinery = game.findNearestStructure(this.x, this.y, this.houseId, 12);
        if (refinery) {
            this.assignedRefinery = refinery;
            this.moveTo(refinery.x + refinery.data.tileWidth / 2,
                       refinery.y + refinery.data.tileHeight / 2, game);
        } else {
            this.harvesterState = 'idle';
            this.state = 'idle';
        }
    }

    _updateCarryall(dt, game) {
        // Simple carryall: just hover around for now
        // Full implementation will pick up harvesters
    }

    _updateCombatUnit(dt, game) {
        if (this.attackTarget && this.attackTarget.alive) {
            const dx = this.attackTarget.x - this.x;
            const dy = this.attackTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.data.weaponRange) {
                this.state = 'attacking';
                this.path = null;
                if (this.attackCooldown <= 0) {
                    this.attackTarget.takeDamage(this.data.damage);
                    this.attackCooldown = 1.5;
                }
            } else {
                this.moveTo(this.attackTarget.x, this.attackTarget.y, game);
            }
        }
    }

    moveTo(worldX, worldY, game) {
        const path = game.pathfinding.findPath(
            this.x, this.y, worldX, worldY, this.data.movementType
        );
        if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
            this.state = 'moving';
        }
    }

    attack(target) {
        this.attackTarget = target;
        this.state = 'attacking';
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.alive = false;
        }
    }

    getScreenPos(tileSize) {
        return {
            x: this.x * tileSize,
            y: this.y * tileSize
        };
    }

    isAt(tileX, tileY) {
        return Math.floor(this.x) === tileX && Math.floor(this.y) === tileY;
    }
}
