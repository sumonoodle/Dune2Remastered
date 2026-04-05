const TILE_SIZE = 32;
const EDGE_SCROLL_ZONE = 20;
const SCROLL_SPEED = 400; // pixels per second
const SCROLL_ACCEL = 1200;
const SCROLL_DECEL = 2400;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_SPEED = 0.12;
const ZOOM_LERP = 0.15;

export class Camera {
    constructor(mapWidth, mapHeight) {
        this.x = 0;
        this.y = 0;
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.viewportWidth = 800;
        this.viewportHeight = 600;
        this.mapWidth = mapWidth * TILE_SIZE;
        this.mapHeight = mapHeight * TILE_SIZE;

        // Scroll velocity for smooth acceleration
        this.vx = 0;
        this.vy = 0;

        // Edge scroll state
        this.edgeScrollX = 0;
        this.edgeScrollY = 0;

        // WASD state
        this.scrollKeys = { up: false, down: false, left: false, right: false };
    }

    setViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    update(dt, mouseX, mouseY) {
        // Calculate desired scroll direction
        let targetVX = 0;
        let targetVY = 0;

        // Edge scrolling
        if (mouseX >= 0 && mouseY >= 0 &&
            mouseX <= this.viewportWidth && mouseY <= this.viewportHeight) {
            if (mouseX < EDGE_SCROLL_ZONE) targetVX -= SCROLL_SPEED;
            if (mouseX > this.viewportWidth - EDGE_SCROLL_ZONE) targetVX += SCROLL_SPEED;
            if (mouseY < EDGE_SCROLL_ZONE) targetVY -= SCROLL_SPEED;
            if (mouseY > this.viewportHeight - EDGE_SCROLL_ZONE) targetVY += SCROLL_SPEED;
        }

        // WASD scrolling
        if (this.scrollKeys.left) targetVX -= SCROLL_SPEED;
        if (this.scrollKeys.right) targetVX += SCROLL_SPEED;
        if (this.scrollKeys.up) targetVY -= SCROLL_SPEED;
        if (this.scrollKeys.down) targetVY += SCROLL_SPEED;

        // Apply acceleration/deceleration
        if (targetVX !== 0) {
            this.vx += Math.sign(targetVX) * SCROLL_ACCEL * dt;
            this.vx = Math.sign(this.vx) * Math.min(Math.abs(this.vx), SCROLL_SPEED);
        } else {
            if (Math.abs(this.vx) < SCROLL_DECEL * dt) {
                this.vx = 0;
            } else {
                this.vx -= Math.sign(this.vx) * SCROLL_DECEL * dt;
            }
        }

        if (targetVY !== 0) {
            this.vy += Math.sign(targetVY) * SCROLL_ACCEL * dt;
            this.vy = Math.sign(this.vy) * Math.min(Math.abs(this.vy), SCROLL_SPEED);
        } else {
            if (Math.abs(this.vy) < SCROLL_DECEL * dt) {
                this.vy = 0;
            } else {
                this.vy -= Math.sign(this.vy) * SCROLL_DECEL * dt;
            }
        }

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Smooth zoom interpolation
        if (Math.abs(this.zoom - this.targetZoom) > 0.001) {
            this.zoom += (this.targetZoom - this.zoom) * ZOOM_LERP;
        } else {
            this.zoom = this.targetZoom;
        }

        // Clamp to map bounds
        this.clampToBounds();
    }

    clampToBounds() {
        const viewW = this.viewportWidth / this.zoom;
        const viewH = this.viewportHeight / this.zoom;

        this.x = Math.max(0, Math.min(this.x, this.mapWidth - viewW));
        this.y = Math.max(0, Math.min(this.y, this.mapHeight - viewH));
    }

    zoomAt(delta, mouseX, mouseY) {
        const oldZoom = this.targetZoom;
        this.targetZoom *= (1 - delta * ZOOM_SPEED);
        this.targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.targetZoom));

        // Zoom toward mouse position
        const worldX = this.x + mouseX / oldZoom;
        const worldY = this.y + mouseY / oldZoom;
        this.x = worldX - mouseX / this.targetZoom;
        this.y = worldY - mouseY / this.targetZoom;
    }

    centerOn(worldX, worldY) {
        this.x = worldX - this.viewportWidth / (2 * this.zoom);
        this.y = worldY - this.viewportHeight / (2 * this.zoom);
        this.clampToBounds();
    }

    screenToWorld(screenX, screenY) {
        return {
            x: this.x + screenX / this.zoom,
            y: this.y + screenY / this.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom,
            y: (worldY - this.y) * this.zoom
        };
    }

    getVisibleTileRange(tileSize) {
        const startX = Math.floor(this.x / tileSize);
        const startY = Math.floor(this.y / tileSize);
        const endX = Math.ceil((this.x + this.viewportWidth / this.zoom) / tileSize);
        const endY = Math.ceil((this.y + this.viewportHeight / this.zoom) / tileSize);

        return {
            startX: Math.max(0, startX),
            startY: Math.max(0, startY),
            endX: Math.min(63, endX),
            endY: Math.min(63, endY)
        };
    }
}
