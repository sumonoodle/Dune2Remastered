import { UNIT_DATA, UNIT_TYPE } from '../data/units.js';
import { TERRAIN } from '../data/terrain.js';
import { STRUCTURE_TYPE } from '../data/structures.js';

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
        // Air units fly faster since they ignore terrain
        this.moveSpeed = this.data.isAirUnit
            ? Math.max(6, this.data.speed * 0.08)
            : Math.max(1.5, this.data.speed * 0.06); // tiles per second

        // Harvester-specific
        this.spiceCarried = 0;
        this.spiceCapacity = this.data.spiceCapacity || 0;
        this.harvesterState = 'idle'; // idle, seeking, harvesting, returning, depositing
        this.harvestTimer = 0;
        this.assignedRefinery = null;
        this.carriedByCarryall = false; // true when being transported

        // Carryall-specific
        this.carryingUnit = null;
        this.carryallState = 'idle'; // idle, pickingUp, delivering
        this.carryallTarget = null;
        this.carryallScanTimer = 0;

        // Combat
        this.attackTarget = null;
        this.attackCooldown = 0;

        // State
        this.state = 'idle'; // idle, moving, attacking, harvesting
        this.alive = true;
        this.visible = true; // false when carried by carryall
    }

    update(dt, game) {
        if (!this.alive || this.carriedByCarryall) return;

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
                    const harvested = game.map.harvestSpice(tx, ty, 5);
                    this.spiceCarried += harvested;

                    if (this.spiceCarried >= this.spiceCapacity) {
                        // Full — return to refinery
                        this._returnToRefinery(game);
                    } else if (harvested === 0) {
                        // Tile depleted — seek next spice tile
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
        switch (this.carryallState) {
            case 'idle':
                this.carryallScanTimer += dt;
                if (this.carryallScanTimer < 1.0) return; // Scan every second
                this.carryallScanTimer = 0;

                // Find a harvester that needs pickup (full and not already assigned a carryall)
                const harvester = this._findHarvesterNeedingPickup(game);
                if (harvester) {
                    this.carryallTarget = harvester;
                    harvester.assignedCarryall = this;
                    this.carryallState = 'pickingUp';
                    // Fly directly to harvester (air units ignore terrain)
                    this._flyTo(harvester.x, harvester.y);
                }
                break;

            case 'pickingUp':
                if (!this.carryallTarget || !this.carryallTarget.alive) {
                    this._carryallReset();
                    break;
                }

                // Update flight target to track moving harvester
                if (!this.path || this.pathIndex >= (this.path?.length || 0)) {
                    const dx = this.carryallTarget.x - this.x;
                    const dy = this.carryallTarget.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 0.5) {
                        // Pick up the harvester
                        this.carryingUnit = this.carryallTarget;
                        this.carryingUnit.visible = false;
                        this.carryingUnit.carriedByCarryall = true;
                        this.carryingUnit.path = null;

                        // Determine delivery destination
                        if (this.carryingUnit.spiceCarried >= this.carryingUnit.spiceCapacity * 0.8) {
                            // Full harvester → deliver to refinery
                            const refinery = game.findNearestStructure(
                                this.x, this.y, this.houseId, STRUCTURE_TYPE.REFINERY
                            );
                            if (refinery) {
                                const dropX = refinery.x + refinery.data.tileWidth / 2;
                                const dropY = refinery.y + refinery.data.tileHeight;
                                this._flyTo(dropX, dropY);
                                this.carryallState = 'delivering';
                            } else {
                                this._carryallDropUnit(game);
                            }
                        } else {
                            // Empty/partial harvester → deliver to nearest spice
                            const spiceTile = this._findNearestSpice(game);
                            if (spiceTile) {
                                this._flyTo(spiceTile.x + 0.5, spiceTile.y + 0.5);
                                this.carryallState = 'delivering';
                            } else {
                                this._carryallDropUnit(game);
                            }
                        }
                    } else {
                        this._flyTo(this.carryallTarget.x, this.carryallTarget.y);
                    }
                }
                break;

            case 'delivering':
                if (!this.path || this.pathIndex >= (this.path?.length || 0)) {
                    this._carryallDropUnit(game);
                }
                break;
        }
    }

    _flyTo(targetX, targetY) {
        // Air units fly in a straight line (no A* needed)
        this.path = [{ x: targetX, y: targetY }];
        this.pathIndex = 0;
        this.state = 'moving';
    }

    _carryallDropUnit(game) {
        if (this.carryingUnit) {
            this.carryingUnit.x = this.x;
            this.carryingUnit.y = this.y;
            this.carryingUnit.visible = true;
            this.carryingUnit.carriedByCarryall = false;
            this.carryingUnit.assignedCarryall = null;
            // Resume harvester AI
            if (this.carryingUnit.type === UNIT_TYPE.HARVESTER) {
                if (this.carryingUnit.spiceCarried > 0) {
                    // Dropped near refinery — start depositing immediately
                    this.carryingUnit.harvesterState = 'depositing';
                    this.carryingUnit.harvestTimer = 0;
                } else {
                    this.carryingUnit.harvesterState = 'idle';
                }
            }
        }
        this._carryallReset();
    }

    _carryallReset() {
        if (this.carryallTarget) {
            this.carryallTarget.assignedCarryall = null;
        }
        this.carryingUnit = null;
        this.carryallTarget = null;
        this.carryallState = 'idle';
        this.state = 'idle';
    }

    _findHarvesterNeedingPickup(game) {
        let best = null;
        let bestDist = Infinity;

        for (const unit of game.units) {
            if (!unit.alive || unit.houseId !== this.houseId) continue;
            if (unit.type !== UNIT_TYPE.HARVESTER) continue;
            if (unit.carriedByCarryall || unit.assignedCarryall) continue;

            // Pick up harvesters that are full and returning
            const isFull = unit.spiceCarried >= unit.spiceCapacity * 0.8;
            const isReturning = unit.harvesterState === 'returning';
            if (!isFull && !isReturning) continue;

            const dx = unit.x - this.x;
            const dy = unit.y - this.y;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                best = unit;
            }
        }
        return best;
    }

    _findNearestSpice(game) {
        const tx = Math.floor(this.x);
        const ty = Math.floor(this.y);

        for (let r = 1; r < 30; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const sx = tx + dx;
                    const sy = ty + dy;
                    const tile = game.map.getTile(sx, sy);
                    if (tile && (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE)) {
                        return { x: sx, y: sy };
                    }
                }
            }
        }
        return null;
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
