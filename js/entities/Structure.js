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
    }

    _completeBuild(game, buildItem) {
        // Spawn the unit near the structure
        const spawnX = this.x + this.data.tileWidth;
        const spawnY = this.y + Math.floor(this.data.tileHeight / 2);
        game.createUnit(buildItem.unitType, spawnX, spawnY, this.houseId);
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

    static canPlace(map, type, tileX, tileY, structures) {
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
        return true;
    }
}
