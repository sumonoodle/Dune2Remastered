// A* pathfinding on tile grid
export class Pathfinding {
    constructor(gameMap) {
        this.map = gameMap;
    }

    findPath(startX, startY, endX, endY, movementType) {
        const sx = Math.floor(startX);
        const sy = Math.floor(startY);
        const ex = Math.floor(endX);
        const ey = Math.floor(endY);

        if (sx === ex && sy === ey) return [{ x: ex, y: ey }];

        // If destination is impassable, find nearest passable tile
        if (!this.map.isPassable(ex, ey, movementType)) {
            const alt = this._findNearestPassable(ex, ey, movementType);
            if (!alt) return null;
            return this.findPath(startX, startY, alt.x, alt.y, movementType);
        }

        const open = new MinHeap();
        const closed = new Set();
        const gScore = new Map();
        const parent = new Map();

        const startKey = this._key(sx, sy);
        gScore.set(startKey, 0);
        open.push({ x: sx, y: sy, f: this._heuristic(sx, sy, ex, ey) });

        let iterations = 0;
        const maxIterations = 2000;

        while (open.size > 0 && iterations < maxIterations) {
            iterations++;
            const current = open.pop();
            const ck = this._key(current.x, current.y);

            if (current.x === ex && current.y === ey) {
                return this._reconstructPath(parent, current.x, current.y);
            }

            if (closed.has(ck)) continue;
            closed.add(ck);

            const neighbors = this._getNeighbors(current.x, current.y, movementType);
            for (const n of neighbors) {
                const nk = this._key(n.x, n.y);
                if (closed.has(nk)) continue;

                const tentativeG = (gScore.get(ck) || 0) + n.cost;
                if (tentativeG < (gScore.get(nk) || Infinity)) {
                    gScore.set(nk, tentativeG);
                    parent.set(nk, ck);
                    open.push({
                        x: n.x, y: n.y,
                        f: tentativeG + this._heuristic(n.x, n.y, ex, ey)
                    });
                }
            }
        }

        return null; // No path found
    }

    _heuristic(x1, y1, x2, y2) {
        // Dune II uses: max(dx,dy) + min(dx,dy)/2
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        return Math.max(dx, dy) + Math.min(dx, dy) * 0.5;
    }

    _getNeighbors(x, y, movementType) {
        const neighbors = [];
        const dirs = [
            { dx: -1, dy: 0, cost: 1.0 },
            { dx: 1,  dy: 0, cost: 1.0 },
            { dx: 0,  dy: -1, cost: 1.0 },
            { dx: 0,  dy: 1, cost: 1.0 },
            { dx: -1, dy: -1, cost: 1.414 },
            { dx: 1,  dy: -1, cost: 1.414 },
            { dx: -1, dy: 1, cost: 1.414 },
            { dx: 1,  dy: 1, cost: 1.414 }
        ];

        for (const dir of dirs) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;

            if (nx < 0 || nx >= this.map.width || ny < 0 || ny >= this.map.height) continue;
            if (!this.map.isPassable(nx, ny, movementType)) continue;

            // For diagonal movement, check that both adjacent tiles are passable
            if (dir.dx !== 0 && dir.dy !== 0) {
                if (!this.map.isPassable(x + dir.dx, y, movementType) ||
                    !this.map.isPassable(x, y + dir.dy, movementType)) {
                    continue;
                }
            }

            neighbors.push({ x: nx, y: ny, cost: dir.cost });
        }

        return neighbors;
    }

    _findNearestPassable(x, y, movementType) {
        for (let r = 1; r < 10; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (this.map.isPassable(nx, ny, movementType)) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

    _key(x, y) {
        return (y << 7) | x;
    }

    _reconstructPath(parent, ex, ey) {
        const path = [];
        let key = this._key(ex, ey);
        while (key !== undefined) {
            const x = key & 0x7F;
            const y = key >> 7;
            path.unshift({ x: x + 0.5, y: y + 0.5 }); // Center of tile
            key = parent.get(key);
        }
        return path;
    }
}

// Simple binary min-heap for A*
class MinHeap {
    constructor() {
        this.data = [];
    }
    get size() { return this.data.length; }

    push(item) {
        this.data.push(item);
        this._bubbleUp(this.data.length - 1);
    }

    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top;
    }

    _bubbleUp(i) {
        while (i > 0) {
            const pi = (i - 1) >> 1;
            if (this.data[i].f >= this.data[pi].f) break;
            [this.data[i], this.data[pi]] = [this.data[pi], this.data[i]];
            i = pi;
        }
    }

    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
            if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
            if (smallest === i) break;
            [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
            i = smallest;
        }
    }
}
