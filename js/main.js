import { GameMap } from './engine/Map.js';
import { Camera } from './engine/Camera.js';
import { Input } from './engine/Input.js';
import { Renderer } from './engine/Renderer.js';
import { Pathfinding } from './systems/Pathfinding.js';
import { Unit } from './entities/Unit.js';
import { Structure } from './entities/Structure.js';
import { UNIT_TYPE, UNIT_DATA } from './data/units.js';
import { STRUCTURE_TYPE, STRUCTURE_DATA, BUILDABLE_STRUCTURES } from './data/structures.js';
import { HOUSE, HOUSE_DATA } from './data/houses.js';
import { TERRAIN } from './data/terrain.js';

const TILE_SIZE = 32;

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.minimapCanvas = document.getElementById('minimap-canvas');

        // Core systems
        this.map = new GameMap();
        this.camera = new Camera(this.map.width, this.map.height);
        this.input = new Input(this.canvas);
        this.renderer = new Renderer(this.canvas, this.minimapCanvas);
        this.pathfinding = new Pathfinding(this.map);

        // Game state
        this.units = [];
        this.structures = [];
        this.playerHouse = HOUSE.ATREIDES;
        this.enemyHouse = HOUSE.HARKONNEN;
        this.credits = { [HOUSE.ATREIDES]: 1500, [HOUSE.HARKONNEN]: 2000 };
        this.power = { [HOUSE.ATREIDES]: { used: 0, produced: 0 }, [HOUSE.HARKONNEN]: { used: 0, produced: 0 } };

        // Placement mode
        this.placementMode = false;
        this.placementType = null;
        this.placementData = null;

        // Command feedback markers
        this.commandMarkers = [];
        this.projectiles = [];

        // Game loop
        this.tickCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.fpsFrames = 0;
        this.fpsTime = 0;

        // Debug
        this.debugVisible = false;

        this._setupInput();
        this._setupUI();
        this._setupInitialState();
        this._resize();

        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const sidebar = document.getElementById('sidebar');
        const sidebarWidth = sidebar.offsetWidth;
        const width = window.innerWidth - sidebarWidth;
        const height = window.innerHeight;

        this.renderer.resize(width, height);
        this.camera.setViewport(width, height);
    }

    _setupInput() {
        // WASD scrolling
        this.input.on('keyDown', ({ key }) => {
            if (key === '`' || key === '~') {
                this.debugVisible = !this.debugVisible;
                document.getElementById('debug-panel').style.display =
                    this.debugVisible ? 'block' : 'none';
            }
            if (key === 'escape') {
                this._cancelPlacement();
                this._deselectAll();
            }
        });

        // Left click - select or place
        this.input.on('leftClick', ({ x, y, shift, double }) => {
            if (this.placementMode) {
                this._handlePlacement(x, y);
                return;
            }

            const worldPos = this.camera.screenToWorld(x, y);
            const tileX = Math.floor(worldPos.x / TILE_SIZE);
            const tileY = Math.floor(worldPos.y / TILE_SIZE);

            if (double) {
                this._selectAllOfType(worldPos);
                return;
            }

            if (!shift) this._deselectAll();

            // Try to select a unit
            const unit = this._findUnitAt(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE);
            if (unit && unit.houseId === this.playerHouse) {
                unit.selected = !unit.selected || !shift;
                this._updateSelectionInfo();
                return;
            }

            // Try to select a structure
            const structure = this._findStructureAt(tileX, tileY);
            if (structure && structure.houseId === this.playerHouse) {
                structure.selected = true;
                this._updateSelectionInfo();
                return;
            }

            this._updateSelectionInfo();
        });

        // Right click - command
        this.input.on('rightClick', ({ x, y }) => {
            if (this.placementMode) {
                this._cancelPlacement();
                return;
            }

            const worldPos = this.camera.screenToWorld(x, y);
            const tileX = Math.floor(worldPos.x / TILE_SIZE);
            const tileY = Math.floor(worldPos.y / TILE_SIZE);

            // Rally point: if a production structure is selected, set rally point
            const selectedStructure = this.structures.find(s => s.selected && s.alive && s.houseId === this.playerHouse);
            if (selectedStructure && selectedStructure.data.builds) {
                selectedStructure.rallyX = tileX + 0.5;
                selectedStructure.rallyY = tileY + 0.5;
                this._addCommandMarker(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE, 'rally');
                return;
            }

            const selected = this.units.filter(u => u.selected && u.alive);

            if (selected.length === 0) return;

            // Check if right-clicking an enemy
            const enemy = this._findEnemyAt(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE);
            if (enemy) {
                for (const unit of selected) {
                    unit.attack(enemy);
                }
                this._addCommandMarker(enemy.x, enemy.y, 'attack');
                return;
            }

            // Check if right-clicking on spice with harvester
            const tile = this.map.getTile(tileX, tileY);
            const harvesters = selected.filter(u => u.type === UNIT_TYPE.HARVESTER);
            if (harvesters.length > 0 && tile &&
                (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE)) {
                for (const h of harvesters) {
                    h.harvesterState = 'seeking';
                    h.moveTo(tileX + 0.5, tileY + 0.5, this);
                }
                return;
            }

            // Move command
            for (const unit of selected) {
                if (unit.type === UNIT_TYPE.HARVESTER) {
                    unit.harvesterState = 'manual';
                }
                unit.attackTarget = null;
                unit.moveTo(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE, this);
                unit.state = 'moving';
            }
            this._addCommandMarker(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE, 'move');
        });

        // Drag select
        this.input.on('dragSelect', ({ x1, y1, x2, y2, shift }) => {
            if (this.placementMode) return;
            if (!shift) this._deselectAll();

            const w1 = this.camera.screenToWorld(x1, y1);
            const w2 = this.camera.screenToWorld(x2, y2);

            for (const unit of this.units) {
                if (!unit.alive || unit.houseId !== this.playerHouse) continue;
                const ux = unit.x * TILE_SIZE;
                const uy = unit.y * TILE_SIZE;
                if (ux >= w1.x && ux <= w2.x && uy >= w1.y && uy <= w2.y) {
                    unit.selected = true;
                }
            }
            this._updateSelectionInfo();
        });

        // Zoom
        this.input.on('wheel', ({ delta, x, y }) => {
            this.camera.zoomAt(delta, x, y);
        });

        // Minimap click
        this.minimapCanvas.addEventListener('mousedown', (e) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.renderer.minimapSize;
            const my = (e.clientY - rect.top) / this.renderer.minimapSize;
            const worldX = mx * this.map.width * TILE_SIZE;
            const worldY = my * this.map.height * TILE_SIZE;

            if (e.button === 0) {
                this.camera.centerOn(worldX, worldY);
            } else if (e.button === 2) {
                const selected = this.units.filter(u => u.selected && u.alive);
                for (const unit of selected) {
                    unit.moveTo(worldX / TILE_SIZE, worldY / TILE_SIZE, this);
                    unit.state = 'moving';
                }
            }
        });

        this.minimapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _setupUI() {
        // Build tabs
        document.querySelectorAll('.build-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.build-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._populateBuildPanel(tab.dataset.tab);
            });
        });

        this._populateBuildPanel('structures');
    }

    _populateBuildPanel(tabType) {
        const container = document.getElementById('build-items');
        container.innerHTML = '';

        if (tabType === 'structures') {
            for (const type of BUILDABLE_STRUCTURES) {
                const data = STRUCTURE_DATA[type];
                const canAfford = this.credits[this.playerHouse] >= data.cost;
                const hasPrereqs = this._hasPrerequisites(type);

                const item = document.createElement('div');
                item.className = 'build-item' + (!canAfford || !hasPrereqs ? ' disabled' : '');
                item.innerHTML = `${data.name}<div class="cost">$${data.cost}</div>`;
                item.addEventListener('click', () => {
                    if (canAfford && hasPrereqs) {
                        this._startPlacement(type);
                    }
                });
                container.appendChild(item);
            }
        } else if (tabType === 'units') {
            // Show buildable units based on owned structures
            const buildableUnits = this._getBuildableUnits();
            for (const { unitType, data } of buildableUnits) {
                const canAfford = this.credits[this.playerHouse] >= data.cost;
                const item = document.createElement('div');
                item.className = 'build-item' + (!canAfford ? ' disabled' : '');
                item.innerHTML = `${data.name}<div class="cost">$${data.cost}</div>`;
                item.addEventListener('click', () => {
                    if (canAfford) {
                        this._buildUnit(unitType);
                    }
                });
                container.appendChild(item);
            }
        }
    }

    _getBuildableUnits() {
        const result = [];
        const ownedTypes = new Set(
            this.structures
                .filter(s => s.alive && s.houseId === this.playerHouse)
                .map(s => s.type)
        );

        const unitMap = {
            [STRUCTURE_TYPE.BARRACKS]: [UNIT_TYPE.SOLDIER, UNIT_TYPE.INFANTRY],
            [STRUCTURE_TYPE.WOR]: [UNIT_TYPE.TROOPER, UNIT_TYPE.TROOPERS],
            [STRUCTURE_TYPE.LIGHT_FACTORY]: [UNIT_TYPE.TRIKE, UNIT_TYPE.QUAD],
            [STRUCTURE_TYPE.HEAVY_FACTORY]: [UNIT_TYPE.TANK, UNIT_TYPE.SIEGE_TANK, UNIT_TYPE.HARVESTER, UNIT_TYPE.MCV, UNIT_TYPE.LAUNCHER],
            [STRUCTURE_TYPE.HI_TECH]: [UNIT_TYPE.CARRYALL, UNIT_TYPE.ORNITHOPTER]
        };

        for (const [structType, unitTypes] of Object.entries(unitMap)) {
            if (ownedTypes.has(Number(structType))) {
                for (const ut of unitTypes) {
                    const data = UNIT_DATA[ut];
                    if (data) result.push({ unitType: ut, data });
                }
            }
        }
        return result;
    }

    _buildUnit(unitType) {
        const data = UNIT_DATA[unitType];
        if (this.credits[this.playerHouse] < data.cost) return;

        // Find the production structure
        const structMap = {
            [UNIT_TYPE.SOLDIER]: STRUCTURE_TYPE.BARRACKS,
            [UNIT_TYPE.INFANTRY]: STRUCTURE_TYPE.BARRACKS,
            [UNIT_TYPE.TROOPER]: STRUCTURE_TYPE.WOR,
            [UNIT_TYPE.TROOPERS]: STRUCTURE_TYPE.WOR,
            [UNIT_TYPE.TRIKE]: STRUCTURE_TYPE.LIGHT_FACTORY,
            [UNIT_TYPE.QUAD]: STRUCTURE_TYPE.LIGHT_FACTORY,
            [UNIT_TYPE.TANK]: STRUCTURE_TYPE.HEAVY_FACTORY,
            [UNIT_TYPE.SIEGE_TANK]: STRUCTURE_TYPE.HEAVY_FACTORY,
            [UNIT_TYPE.HARVESTER]: STRUCTURE_TYPE.HEAVY_FACTORY,
            [UNIT_TYPE.MCV]: STRUCTURE_TYPE.HEAVY_FACTORY,
            [UNIT_TYPE.LAUNCHER]: STRUCTURE_TYPE.HEAVY_FACTORY,
            [UNIT_TYPE.CARRYALL]: STRUCTURE_TYPE.HI_TECH,
            [UNIT_TYPE.ORNITHOPTER]: STRUCTURE_TYPE.HI_TECH
        };

        const requiredStructType = structMap[unitType];
        const factory = this.structures.find(s =>
            s.alive && s.houseId === this.playerHouse && s.type === requiredStructType
        );

        if (!factory) return;

        this.credits[this.playerHouse] -= data.cost;
        const spawnX = factory.x + factory.data.tileWidth;
        const spawnY = factory.y + Math.floor(factory.data.tileHeight / 2);
        this.createUnit(unitType, spawnX, spawnY, this.playerHouse);
        this._updateUI();
    }

    _hasPrerequisites(structureType) {
        const data = STRUCTURE_DATA[structureType];
        if (!data.prerequisite || data.prerequisite.length === 0) return true;

        const ownedTypes = new Set(
            this.structures
                .filter(s => s.alive && s.houseId === this.playerHouse)
                .map(s => s.type)
        );

        return data.prerequisite.every(req => ownedTypes.has(req));
    }

    _startPlacement(structureType) {
        this.placementMode = true;
        this.placementType = structureType;
        this.placementData = STRUCTURE_DATA[structureType];
    }

    _cancelPlacement() {
        this.placementMode = false;
        this.placementType = null;
        this.placementData = null;
    }

    _handlePlacement(screenX, screenY) {
        const worldPos = this.camera.screenToWorld(screenX, screenY);
        const tileX = Math.floor(worldPos.x / TILE_SIZE);
        const tileY = Math.floor(worldPos.y / TILE_SIZE);

        if (this.canPlaceStructure(this.placementType, tileX, tileY)) {
            const data = STRUCTURE_DATA[this.placementType];
            if (this.credits[this.playerHouse] >= data.cost) {
                this.credits[this.playerHouse] -= data.cost;
                this.createStructure(this.placementType, tileX, tileY, this.playerHouse);
                this._updateUI();

                // Stay in placement mode if shift is held
                if (!this.input.isKeyDown('shift')) {
                    this._cancelPlacement();
                }
            }
        }
    }

    canPlaceStructure(type, tileX, tileY) {
        return Structure.canPlace(this.map, type, tileX, tileY, this.structures, this.playerHouse);
    }

    createUnit(type, tileX, tileY, houseId) {
        const unit = new Unit(type, tileX, tileY, houseId);
        this.units.push(unit);
        return unit;
    }

    createStructure(type, tileX, tileY, houseId) {
        const structure = new Structure(type, tileX, tileY, houseId);
        this.structures.push(structure);

        // Mark tiles as structure
        const data = STRUCTURE_DATA[type];
        for (let dy = 0; dy < data.tileHeight; dy++) {
            for (let dx = 0; dx < data.tileWidth; dx++) {
                const tile = this.map.getTile(tileX + dx, tileY + dy);
                if (tile) {
                    tile.terrain = TERRAIN.STRUCTURE;
                    tile.structureId = structure.id;
                }
            }
        }

        // Update power
        this._recalculatePower();

        return structure;
    }

    addCredits(houseId, amount) {
        this.credits[houseId] = (this.credits[houseId] || 0) + amount;
    }

    findNearestStructure(worldX, worldY, houseId, structureType) {
        let best = null;
        let bestDist = Infinity;

        for (const s of this.structures) {
            if (!s.alive || s.houseId !== houseId) continue;
            if (structureType !== undefined && s.type !== structureType) continue;

            const center = s.getCenterWorld();
            const dx = center.x - worldX;
            const dy = center.y - worldY;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                best = s;
            }
        }
        return best;
    }

    _updateCursor() {
        const selected = this.units.filter(u => u.selected && u.alive);
        if (this.placementMode) {
            this.canvas.style.cursor = 'cell';
            return;
        }
        if (selected.length === 0) {
            this.canvas.style.cursor = 'default';
            return;
        }

        const worldPos = this.camera.screenToWorld(this.input.mouseX, this.input.mouseY);
        const tileX = worldPos.x / TILE_SIZE;
        const tileY = worldPos.y / TILE_SIZE;

        // Check for enemy under cursor
        const enemy = this._findEnemyAt(tileX, tileY);
        if (enemy) {
            this.canvas.style.cursor = 'crosshair';
            return;
        }

        // Check for spice under cursor with harvester selected
        const tile = this.map.getTile(Math.floor(tileX), Math.floor(tileY));
        const hasHarvester = selected.some(u => u.type === UNIT_TYPE.HARVESTER);
        if (hasHarvester && tile &&
            (tile.terrain === TERRAIN.SPICE || tile.terrain === TERRAIN.THICK_SPICE)) {
            this.canvas.style.cursor = 'grab';
            return;
        }

        this.canvas.style.cursor = 'pointer';
    }

    _addCommandMarker(tileX, tileY, type) {
        this.commandMarkers.push({ x: tileX, y: tileY, type, timer: 0.6 });
    }

    _findUnitAt(worldTileX, worldTileY) {
        let closest = null;
        let closestDist = 0.8; // Max click distance in tiles

        for (const unit of this.units) {
            if (!unit.alive) continue;
            const dx = unit.x - worldTileX;
            const dy = unit.y - worldTileY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = unit;
            }
        }
        return closest;
    }

    _findEnemyAt(worldTileX, worldTileY) {
        let closest = null;
        let closestDist = 0.8;

        for (const unit of this.units) {
            if (!unit.alive || unit.houseId === this.playerHouse) continue;
            const dx = unit.x - worldTileX;
            const dy = unit.y - worldTileY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist = dist;
                closest = unit;
            }
        }
        return closest;
    }

    _findStructureAt(tileX, tileY) {
        for (const s of this.structures) {
            if (s.alive && s.occupiesTile(tileX, tileY)) return s;
        }
        return null;
    }

    _selectAllOfType(worldPos) {
        const clicked = this._findUnitAt(worldPos.x / TILE_SIZE, worldPos.y / TILE_SIZE);
        if (!clicked || clicked.houseId !== this.playerHouse) return;

        this._deselectAll();
        for (const unit of this.units) {
            if (unit.alive && unit.type === clicked.type && unit.houseId === this.playerHouse) {
                unit.selected = true;
            }
        }
        this._updateSelectionInfo();
    }

    _deselectAll() {
        for (const u of this.units) u.selected = false;
        for (const s of this.structures) s.selected = false;
        this._updateSelectionInfo();
    }

    _updateSelectionInfo() {
        const panel = document.getElementById('selection-details');
        const selectedUnits = this.units.filter(u => u.selected && u.alive);
        const selectedStructures = this.structures.filter(s => s.selected && s.alive);

        if (selectedUnits.length > 0) {
            const types = {};
            for (const u of selectedUnits) {
                types[u.data.name] = (types[u.data.name] || 0) + 1;
            }
            let html = '';
            for (const [name, count] of Object.entries(types)) {
                html += `<div>${name}${count > 1 ? ' x' + count : ''}</div>`;
            }
            if (selectedUnits.length === 1) {
                const u = selectedUnits[0];
                html += `<div style="color:#888;margin-top:4px">HP: ${u.hp}/${u.maxHp}</div>`;
                if (u.type === UNIT_TYPE.HARVESTER) {
                    html += `<div style="color:#ffaa00">Spice: ${u.spiceCarried}/${u.spiceCapacity}</div>`;
                    html += `<div style="color:#888">${u.harvesterState}</div>`;
                }
            }
            panel.innerHTML = html;
        } else if (selectedStructures.length > 0) {
            const s = selectedStructures[0];
            panel.innerHTML = `<div>${s.data.name}</div>
                <div style="color:#888">HP: ${s.hp}/${s.maxHp}</div>
                <div style="color:#888">Power: ${s.data.powerUsage > 0 ? '-' : '+'}${Math.abs(s.data.powerUsage)}</div>`;
        } else {
            panel.innerHTML = '<div style="color:#666">No selection</div>';
        }
    }

    _recalculatePower() {
        for (const houseId of [this.playerHouse, this.enemyHouse]) {
            let produced = 0;
            let used = 0;
            for (const s of this.structures) {
                if (!s.alive || s.houseId !== houseId) continue;
                if (s.data.powerUsage < 0) {
                    produced += Math.abs(s.data.powerUsage);
                } else {
                    used += s.data.powerUsage;
                }
            }
            this.power[houseId] = { produced, used };
        }
    }

    _updateUI() {
        document.getElementById('credits-value').textContent =
            Math.floor(this.credits[this.playerHouse]);
        const power = this.power[this.playerHouse];
        const powerEl = document.getElementById('power-value');
        powerEl.textContent = `${power.used} / ${power.produced}`;
        powerEl.style.color = power.used > power.produced ? '#cc4444' : '#66cc66';

        document.getElementById('house-name').textContent =
            `House ${HOUSE_DATA[this.playerHouse].name}`;
        document.getElementById('house-name').style.color =
            HOUSE_DATA[this.playerHouse].lightColor;

        // Refresh build panel
        const activeTab = document.querySelector('.build-tab.active');
        if (activeTab) this._populateBuildPanel(activeTab.dataset.tab);
    }

    _updateDebug() {
        if (!this.debugVisible) return;
        document.getElementById('debug-fps').textContent = `FPS: ${this.fps}`;
        document.getElementById('debug-units').textContent = `Units: ${this.units.filter(u => u.alive).length}`;
        document.getElementById('debug-tick').textContent = `Tick: ${this.tickCount}`;
        document.getElementById('debug-mouse').textContent =
            `Mouse: ${this.input.mouseX}, ${this.input.mouseY}`;
        document.getElementById('debug-camera').textContent =
            `Camera: ${Math.floor(this.camera.x)}, ${Math.floor(this.camera.y)}`;
        document.getElementById('debug-zoom').textContent =
            `Zoom: ${this.camera.zoom.toFixed(2)}`;
    }

    _setupInitialState() {
        // Player base (Atreides - top-left rock area)
        this.createStructure(STRUCTURE_TYPE.CONSTRUCTION_YARD, 7, 7, this.playerHouse);
        this.createStructure(STRUCTURE_TYPE.WINDTRAP, 5, 7, this.playerHouse);
        this.createStructure(STRUCTURE_TYPE.REFINERY, 10, 7, this.playerHouse);
        this.createStructure(STRUCTURE_TYPE.LIGHT_FACTORY, 7, 10, this.playerHouse);

        // Player units
        this.createUnit(UNIT_TYPE.HARVESTER, 13, 8, this.playerHouse);
        this.createUnit(UNIT_TYPE.CARRYALL, 9, 5, this.playerHouse);
        this.createUnit(UNIT_TYPE.TRIKE, 5, 11, this.playerHouse);
        this.createUnit(UNIT_TYPE.TRIKE, 6, 11, this.playerHouse);
        this.createUnit(UNIT_TYPE.SOLDIER, 10, 11, this.playerHouse);
        this.createUnit(UNIT_TYPE.SOLDIER, 11, 11, this.playerHouse);

        // Enemy base (Harkonnen - bottom-right rock area)
        this.createStructure(STRUCTURE_TYPE.CONSTRUCTION_YARD, 51, 51, this.enemyHouse);
        this.createStructure(STRUCTURE_TYPE.WINDTRAP, 49, 51, this.enemyHouse);
        this.createStructure(STRUCTURE_TYPE.REFINERY, 54, 51, this.enemyHouse);
        this.createStructure(STRUCTURE_TYPE.LIGHT_FACTORY, 51, 54, this.enemyHouse);

        // Enemy units
        this.createUnit(UNIT_TYPE.HARVESTER, 57, 52, this.enemyHouse);
        this.createUnit(UNIT_TYPE.CARRYALL, 53, 49, this.enemyHouse);
        this.createUnit(UNIT_TYPE.TANK, 49, 55, this.enemyHouse);
        this.createUnit(UNIT_TYPE.TANK, 50, 55, this.enemyHouse);
        this.createUnit(UNIT_TYPE.SOLDIER, 54, 55, this.enemyHouse);
        this.createUnit(UNIT_TYPE.SOLDIER, 55, 55, this.enemyHouse);

        // Center camera on player base
        this.camera.centerOn(8 * TILE_SIZE, 8 * TILE_SIZE);

        this._recalculatePower();
        this._updateUI();
    }

    update(dt) {
        // Update camera scroll keys
        this.camera.scrollKeys.left = this.input.isKeyDown('a') || this.input.isKeyDown('arrowleft');
        this.camera.scrollKeys.right = this.input.isKeyDown('d') || this.input.isKeyDown('arrowright');
        this.camera.scrollKeys.up = this.input.isKeyDown('w') || this.input.isKeyDown('arrowup');
        this.camera.scrollKeys.down = this.input.isKeyDown('s') || this.input.isKeyDown('arrowdown');

        this.camera.update(dt, this.input.mouseX, this.input.mouseY);

        // Update entities
        for (const unit of this.units) {
            unit.update(dt, this);
        }
        for (const structure of this.structures) {
            structure.update(dt, this);
        }

        // Update projectiles and command markers
        if (this.projectiles) {
            for (const p of this.projectiles) p.timer -= dt;
            this.projectiles = this.projectiles.filter(p => p.timer > 0);
        }
        for (const m of this.commandMarkers) m.timer -= dt;
        this.commandMarkers = this.commandMarkers.filter(m => m.timer > 0);

        // Spice regrowth
        this.map.growSpice(this.tickCount);

        // Simple enemy AI - make harvesters work
        for (const unit of this.units) {
            if (unit.houseId === this.enemyHouse && unit.type === UNIT_TYPE.HARVESTER &&
                unit.harvesterState === 'idle' && unit.alive) {
                unit._seekSpice(this);
            }
        }

        // Cleanup dead entities
        this.units = this.units.filter(u => u.alive);
        this.structures = this.structures.filter(s => {
            if (!s.alive) {
                // Restore terrain when structure is destroyed
                for (let dy = 0; dy < s.data.tileHeight; dy++) {
                    for (let dx = 0; dx < s.data.tileWidth; dx++) {
                        const tile = this.map.getTile(s.x + dx, s.y + dy);
                        if (tile) {
                            tile.terrain = TERRAIN.ROCK;
                            tile.structureId = null;
                        }
                    }
                }
                this._recalculatePower();
                return false;
            }
            return true;
        });

        // Update cursor based on hover context
        this._updateCursor();

        // Update UI periodically
        if (this.tickCount % 30 === 0) {
            this._updateUI();
        }

        this.tickCount++;
    }

    start() {
        const gameLoop = (timestamp) => {
            const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Cap at 50ms
            this.lastTime = timestamp;

            // FPS counter
            this.fpsFrames++;
            this.fpsTime += dt;
            if (this.fpsTime >= 1.0) {
                this.fps = this.fpsFrames;
                this.fpsFrames = 0;
                this.fpsTime = 0;
            }

            this.update(dt);
            this.renderer.render(this);
            this._updateDebug();

            requestAnimationFrame(gameLoop);
        };

        this.lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

// Boot - guard against double-loading
if (!window._game) {
    const game = new Game();
    window._game = game;
    game.start();
}

console.log('Dune II Remastered - Phase 1: Playable Foundation');
console.log('Controls: WASD/Arrow keys to scroll, Mouse wheel to zoom');
console.log('Left click to select, Right click to command');
console.log('Press ` to toggle debug panel');
