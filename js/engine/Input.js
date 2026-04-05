export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        this.mouseDown = false;
        this.rightMouseDown = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.isDragging = false;

        this.keys = {};
        this.callbacks = {
            leftClick: [],
            rightClick: [],
            dragSelect: [],
            wheel: [],
            keyDown: []
        };

        this._bindEvents();
    }

    _bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            if (this.mouseDown) {
                const dx = this.mouseX - this.dragStartX;
                const dy = this.mouseY - this.dragStartY;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                    this.isDragging = true;
                }
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                this.mouseDown = true;
                this.dragStartX = this.mouseX;
                this.dragStartY = this.mouseY;
                this.isDragging = false;
            } else if (e.button === 2) {
                this.rightMouseDown = true;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                if (this.isDragging) {
                    this._fire('dragSelect', {
                        x1: Math.min(this.dragStartX, this.mouseX),
                        y1: Math.min(this.dragStartY, this.mouseY),
                        x2: Math.max(this.dragStartX, this.mouseX),
                        y2: Math.max(this.dragStartY, this.mouseY),
                        shift: e.shiftKey
                    });
                } else {
                    this._fire('leftClick', {
                        x: this.mouseX, y: this.mouseY,
                        shift: e.shiftKey, double: false
                    });
                }
                this.mouseDown = false;
                this.isDragging = false;
            } else if (e.button === 2) {
                this._fire('rightClick', {
                    x: this.mouseX, y: this.mouseY
                });
                this.rightMouseDown = false;
            }
        });

        this.canvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this._fire('leftClick', {
                x: this.mouseX, y: this.mouseY,
                shift: e.shiftKey, double: true
            });
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._fire('wheel', {
                delta: Math.sign(e.deltaY),
                x: this.mouseX,
                y: this.mouseY
            });
        }, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this._fire('keyDown', { key: e.key.toLowerCase(), event: e });
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    _fire(event, data) {
        for (const cb of this.callbacks[event] || []) {
            cb(data);
        }
    }

    isKeyDown(key) {
        return !!this.keys[key.toLowerCase()];
    }

    getDragRect() {
        if (!this.isDragging) return null;
        return {
            x1: Math.min(this.dragStartX, this.mouseX),
            y1: Math.min(this.dragStartY, this.mouseY),
            x2: Math.max(this.dragStartX, this.mouseX),
            y2: Math.max(this.dragStartY, this.mouseY)
        };
    }
}
