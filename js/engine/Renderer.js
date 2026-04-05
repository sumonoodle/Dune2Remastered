import { TERRAIN_COLORS } from '../data/terrain.js';
import { TERRAIN_MINIMAP_COLORS, TERRAIN } from '../data/terrain.js';
import { HOUSE_DATA } from '../data/houses.js';
import { UNIT_TYPE } from '../data/units.js';

const TILE_SIZE = 32;

export class Renderer {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');
        this.minimapSize = 128;
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    render(game) {
        const ctx = this.ctx;
        const camera = game.camera;

        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transform
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        this._renderTerrain(ctx, game);
        this._renderStructures(ctx, game);
        this._renderUnits(ctx, game);
        this._renderProjectiles(ctx, game);
        this._renderCommandMarkers(ctx, game);

        ctx.restore();

        // Render overlays (not affected by camera zoom)
        this._renderSelectionBox(ctx, game);
        this._renderPlacementGhost(ctx, game);
        this._renderMinimap(game);
    }

    _renderTerrain(ctx, game) {
        const camera = game.camera;
        const range = camera.getVisibleTileRange(TILE_SIZE);

        for (let y = range.startY; y <= range.endY; y++) {
            for (let x = range.startX; x <= range.endX; x++) {
                const tile = game.map.getTile(x, y);
                if (!tile) continue;

                const color = TERRAIN_COLORS[tile.terrain] || '#c2a456';
                ctx.fillStyle = color;
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

                // Add subtle noise/variation to terrain
                if (tile.terrain === TERRAIN.SAND || tile.terrain === TERRAIN.DUNE) {
                    const hash = ((x * 7 + y * 13) % 5) * 3;
                    ctx.fillStyle = `rgba(0,0,0,${0.02 + hash * 0.005})`;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }

                // Spice sparkle effect
                if (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE) {
                    const sparkle = Math.sin(Date.now() * 0.003 + x * 3 + y * 7) * 0.5 + 0.5;
                    ctx.fillStyle = `rgba(255,200,100,${sparkle * 0.15})`;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }

                // Mountain shading
                if (tile.terrain === TERRAIN.MOUNTAIN || tile.terrain === TERRAIN.PARTIAL_MOUNTAIN) {
                    ctx.fillStyle = 'rgba(0,0,0,0.15)';
                    ctx.fillRect(x * TILE_SIZE + TILE_SIZE * 0.5, y * TILE_SIZE,
                                TILE_SIZE * 0.5, TILE_SIZE);
                    ctx.fillStyle = 'rgba(255,255,255,0.08)';
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE,
                                TILE_SIZE * 0.5, TILE_SIZE * 0.5);
                }

                // Grid lines (subtle)
                ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    _renderStructures(ctx, game) {
        for (const structure of game.structures) {
            if (!structure.alive) continue;

            const sx = structure.x * TILE_SIZE;
            const sy = structure.y * TILE_SIZE;
            const sw = structure.data.tileWidth * TILE_SIZE;
            const sh = structure.data.tileHeight * TILE_SIZE;

            // House color
            const house = HOUSE_DATA[structure.houseId];
            const baseColor = house ? house.color : '#888888';

            // Structure body
            ctx.fillStyle = structure.data.color;
            ctx.fillRect(sx + 1, sy + 1, sw - 2, sh - 2);

            // House color border
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
            ctx.lineWidth = 1;

            // Inner detail
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(sx + 4, sy + 4, sw - 8, sh - 8);

            // Structure name
            const fontSize = Math.max(8, Math.min(11, sw / structure.data.name.length * 1.5));
            ctx.fillStyle = '#ddd';
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(structure.data.name, sx + sw / 2, sy + sh / 2);

            // Health bar
            if (structure.hp < structure.maxHp) {
                this._renderHealthBar(ctx, sx, sy - 5, sw, 3, structure.hp / structure.maxHp);
            }

            // Selection indicator
            if (structure.selected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 3]);
                ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
                ctx.setLineDash([]);
                ctx.lineWidth = 1;

                // Rally point marker (only for selected production structures)
                if (structure.rallyX !== null && structure.data.builds) {
                    const rx = structure.rallyX * TILE_SIZE;
                    const ry = structure.rallyY * TILE_SIZE;
                    // Line from structure center to rally point
                    ctx.strokeStyle = 'rgba(0, 255, 128, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(sx + sw / 2, sy + sh / 2);
                    ctx.lineTo(rx, ry);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Rally flag
                    ctx.fillStyle = '#00ff80';
                    ctx.beginPath();
                    ctx.moveTo(rx, ry);
                    ctx.lineTo(rx, ry - 12);
                    ctx.lineTo(rx + 8, ry - 8);
                    ctx.lineTo(rx, ry - 4);
                    ctx.fill();
                    ctx.lineWidth = 1;
                }
            }
        }
    }

    _renderUnits(ctx, game) {
        for (const unit of game.units) {
            if (!unit.alive || !unit.visible) continue;

            const wx = unit.x * TILE_SIZE;
            const wy = unit.y * TILE_SIZE;
            const house = HOUSE_DATA[unit.houseId];
            const unitColor = house ? house.color : '#aaa';
            const radius = TILE_SIZE * 0.35;

            // Selection circle
            if (unit.selected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(wx, wy + radius * 0.3, radius + 3, radius * 0.5 + 2, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
            }

            // Unit shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(wx + 1, wy + radius * 0.4, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Unit body
            ctx.fillStyle = unitColor;
            ctx.beginPath();

            if (unit.data.movementType === 0) {
                // Infantry - smaller circle
                ctx.arc(wx, wy, radius * 0.6, 0, Math.PI * 2);
            } else if (unit.type === UNIT_TYPE.HARVESTER) {
                // Harvester - rectangle
                ctx.rect(wx - radius, wy - radius * 0.7, radius * 2, radius * 1.4);
            } else if (unit.data.isAirUnit) {
                // Air unit - diamond
                ctx.moveTo(wx, wy - radius);
                ctx.lineTo(wx + radius, wy);
                ctx.lineTo(wx, wy + radius);
                ctx.lineTo(wx - radius, wy);
                ctx.closePath();
            } else {
                // Vehicle - rounded rect approximation
                ctx.arc(wx, wy, radius, 0, Math.PI * 2);
            }
            ctx.fill();

            // Unit outline
            ctx.strokeStyle = house ? house.darkColor : '#444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineWidth = 1;

            // Inner highlight
            ctx.fillStyle = house ? house.lightColor : '#ccc';
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(wx - radius * 0.2, wy - radius * 0.2, radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

            // Harvester spice indicator
            if (unit.type === UNIT_TYPE.HARVESTER && unit.spiceCarried > 0) {
                const fillRatio = unit.spiceCarried / unit.spiceCapacity;
                ctx.fillStyle = '#ffaa00';
                ctx.fillRect(wx - radius, wy + radius * 0.8,
                            radius * 2 * fillRatio, 3);
                ctx.strokeStyle = '#886600';
                ctx.strokeRect(wx - radius, wy + radius * 0.8,
                              radius * 2, 3);
            }

            // Health bar (only show when damaged)
            if (unit.hp < unit.maxHp) {
                this._renderHealthBar(ctx, wx - radius, wy - radius - 6,
                                     radius * 2, 3, unit.hp / unit.maxHp);
            }

            // Carryall cargo indicator
            if (unit.type === UNIT_TYPE.CARRYALL && unit.carryingUnit) {
                ctx.fillStyle = '#ffaa00';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CARGO', wx, wy + radius + 12);
            }

            // Path visualization (debug)
            if (unit.selected && unit.path && unit.pathIndex < unit.path.length) {
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(wx, wy);
                for (let i = unit.pathIndex; i < unit.path.length; i++) {
                    ctx.lineTo(unit.path[i].x * TILE_SIZE, unit.path[i].y * TILE_SIZE);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    _renderProjectiles(ctx, game) {
        if (!game.projectiles) return;
        for (const p of game.projectiles) {
            const alpha = p.timer / 0.15;
            ctx.strokeStyle = `rgba(255, 200, 50, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x1 * TILE_SIZE, p.y1 * TILE_SIZE);
            ctx.lineTo(p.x2 * TILE_SIZE, p.y2 * TILE_SIZE);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    _renderCommandMarkers(ctx, game) {
        for (const m of game.commandMarkers) {
            const alpha = m.timer / 0.6;
            const wx = m.x * TILE_SIZE;
            const wy = m.y * TILE_SIZE;
            const r = 8 + (1 - alpha) * 12; // Expand outward

            if (m.type === 'move') {
                ctx.strokeStyle = `rgba(0, 255, 0, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(wx, wy, r, 0, Math.PI * 2);
                ctx.stroke();
                // Crosshair
                ctx.beginPath();
                ctx.moveTo(wx - 4, wy);
                ctx.lineTo(wx + 4, wy);
                ctx.moveTo(wx, wy - 4);
                ctx.lineTo(wx, wy + 4);
                ctx.stroke();
            } else if (m.type === 'attack') {
                ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(wx, wy, r, 0, Math.PI * 2);
                ctx.stroke();
                // X marker
                ctx.beginPath();
                ctx.moveTo(wx - 5, wy - 5);
                ctx.lineTo(wx + 5, wy + 5);
                ctx.moveTo(wx + 5, wy - 5);
                ctx.lineTo(wx - 5, wy + 5);
                ctx.stroke();
            } else if (m.type === 'rally') {
                ctx.fillStyle = `rgba(0, 255, 128, ${alpha})`;
                ctx.beginPath();
                ctx.arc(wx, wy, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.lineWidth = 1;
        }
    }

    _renderHealthBar(ctx, x, y, width, height, ratio) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, width, height);
        const color = ratio > 0.6 ? '#0c0' : ratio > 0.3 ? '#cc0' : '#c00';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width * ratio, height);
    }

    _renderSelectionBox(ctx, game) {
        const dragRect = game.input.getDragRect();
        if (dragRect) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(dragRect.x1, dragRect.y1,
                          dragRect.x2 - dragRect.x1, dragRect.y2 - dragRect.y1);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(dragRect.x1, dragRect.y1,
                        dragRect.x2 - dragRect.x1, dragRect.y2 - dragRect.y1);
        }
    }

    _renderPlacementGhost(ctx, game) {
        if (!game.placementMode) return;

        const mouseWorld = game.camera.screenToWorld(game.input.mouseX, game.input.mouseY);
        const tileX = Math.floor(mouseWorld.x / TILE_SIZE);
        const tileY = Math.floor(mouseWorld.y / TILE_SIZE);

        const data = game.placementData;
        if (!data) return;

        const canPlace = game.canPlaceStructure(game.placementType, tileX, tileY);
        const screenPos = game.camera.worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE);
        const w = data.tileWidth * TILE_SIZE * game.camera.zoom;
        const h = data.tileHeight * TILE_SIZE * game.camera.zoom;

        ctx.fillStyle = canPlace ? 'rgba(0,255,0,0.25)' : 'rgba(255,0,0,0.25)';
        ctx.fillRect(screenPos.x, screenPos.y, w, h);
        ctx.strokeStyle = canPlace ? '#0f0' : '#f00';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenPos.x, screenPos.y, w, h);
        ctx.lineWidth = 1;

        // Show structure name
        ctx.fillStyle = '#fff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(data.name, screenPos.x + w / 2, screenPos.y - 6);
    }

    _renderMinimap(game) {
        const mctx = this.minimapCtx;
        const size = this.minimapSize;
        const scale = size / game.map.width;

        mctx.clearRect(0, 0, size, size);

        // Terrain
        for (let y = 0; y < game.map.height; y++) {
            for (let x = 0; x < game.map.width; x++) {
                const tile = game.map.getTile(x, y);
                mctx.fillStyle = TERRAIN_MINIMAP_COLORS[tile.terrain] || '#b09040';
                mctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
            }
        }

        // Structures
        for (const s of game.structures) {
            if (!s.alive) continue;
            const house = HOUSE_DATA[s.houseId];
            mctx.fillStyle = house ? house.minimapColor : '#fff';
            mctx.fillRect(s.x * scale, s.y * scale,
                         s.data.tileWidth * scale, s.data.tileHeight * scale);
        }

        // Units
        for (const u of game.units) {
            if (!u.alive) continue;
            const house = HOUSE_DATA[u.houseId];
            mctx.fillStyle = house ? house.lightColor : '#fff';
            mctx.fillRect((u.x - 0.5) * scale, (u.y - 0.5) * scale,
                         Math.max(2, scale), Math.max(2, scale));
        }

        // Viewport rectangle
        const camera = game.camera;
        const vx = camera.x / TILE_SIZE * scale;
        const vy = camera.y / TILE_SIZE * scale;
        const vw = (camera.viewportWidth / camera.zoom) / TILE_SIZE * scale;
        const vh = (camera.viewportHeight / camera.zoom) / TILE_SIZE * scale;

        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 1;
        mctx.strokeRect(vx, vy, vw, vh);
    }
}
