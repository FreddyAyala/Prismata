export class MobileControls {
    constructor(domElement) {
        this.domElement = domElement;
        this.moveVector = { x: 0, y: 0 };
        this.lookVector = { x: 0, y: 0 }; // Changed from lookDelta
        this.active = false;

        // Configuration
        this.maxRadius = 50;
        this.deadZone = 0.1;

        // Connect to DOM
        this._createUI();
        this._bindEvents();
    }

    _createUI() {
        this.container = document.createElement('div');
        this.container.id = 'mobile-controls-overlay';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '4000';
        this.container.style.display = 'none';

        // --- LEFT STICK (MOVE) ---
        this.leftZone = this._createStickZone('bottom', '20px', 'left', '20px');
        this.leftKnob = this._createKnob();
        this.leftZone.appendChild(this.leftKnob);

        // --- RIGHT STICK (LOOK) ---
        // Positioned in Bottom-Right
        this.rightZone = this._createStickZone('bottom', '30px', 'right', '30px');
        this.rightKnob = this._createKnob();
        this.rightZone.appendChild(this.rightKnob);

        // --- BUTTONS ---
        // Arc around the Top-Left of the Right Stick
        // Stick occupies roughly 30px to 170px from right/bottom.

        // JUMP: Closest, slightly left of stick
        this.jumpBtn = this._createBtn("JUMP", "40px", "180px", "#ff0055", "70px");

        // FIRE: The Big Button - North-West of Stick
        this.fireBtn = this._createBtn("FIRE", "130px", "140px", "#ffaa00", "90px");

        // ALT FIRE: Slightly weaker secondary, positioned conveniently
        this.altBtn = this._createBtn("ALT", "190px", "130px", "#ff5500", "70px");

        // SWAP: Further up/middle
        this.weaponBtn = this._createBtn("SWAP", "180px", "60px", "#00ffff", "60px");

        // Default Hide Combat Buttons
        this.fireBtn.style.display = 'none';
        this.altBtn.style.display = 'none';
        this.weaponBtn.style.display = 'none';

        this.container.appendChild(this.leftZone);
        this.container.appendChild(this.rightZone);
        this.container.appendChild(this.jumpBtn);
        this.container.appendChild(this.fireBtn);
        this.container.appendChild(this.altBtn); // ADDED
        this.container.appendChild(this.weaponBtn);
        document.body.appendChild(this.container);
    }

    _createStickZone(vPosName, vPosVal, hPosName, hPosVal) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style[vPosName] = vPosVal;
        div.style[hPosName] = hPosVal;
        div.style.width = '140px';
        div.style.height = '140px';
        div.style.background = 'rgba(255, 255, 255, 0.05)';
        div.style.border = '2px solid rgba(0, 243, 255, 0.3)';
        div.style.borderRadius = '50%';
        div.style.pointerEvents = 'auto';
        div.style.touchAction = 'none';
        return div;
    }

    _createKnob() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.width = '50px';
        div.style.height = '50px';
        div.style.background = 'rgba(0, 243, 255, 0.5)';
        div.style.borderRadius = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        return div;
    }

    _createBtn(label, bottom, right, color, size = '80px') {
        const btn = document.createElement('div');
        btn.innerText = label;
        btn.style.position = 'absolute';
        btn.style.bottom = bottom;
        btn.style.right = right;
        btn.style.width = size;
        btn.style.height = size;
        btn.style.background = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)`;
        btn.style.border = `1px solid ${color}`;
        btn.style.borderRadius = '50%';
        btn.style.color = '#fff';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontFamily = 'Arial, sans-serif';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = 'bold';
        btn.style.pointerEvents = 'auto';
        btn.style.zIndex = '4001';
        btn.style.userSelect = 'none';
        btn.style.touchAction = 'none';
        return btn;
    }

    _bindEvents() {
        // --- Joystick Logic (Generic) ---
        const handleStick = (e, zone, knob, vectorOut) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.targetTouches[0];
            if (!touch) return;

            const rect = zone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            let x = touch.clientX - centerX;
            let y = touch.clientY - centerY;
            const dist = Math.sqrt(x * x + y * y);

            if (dist > this.maxRadius) {
                const angle = Math.atan2(y, x);
                x = Math.cos(angle) * this.maxRadius;
                y = Math.sin(angle) * this.maxRadius;
            }

            knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

            // Normalize (-1 to 1)
            let nx = x / this.maxRadius;
            let ny = y / this.maxRadius;

            // Deadzone
            if (Math.abs(nx) < 0.05) nx = 0;
            if (Math.abs(ny) < 0.05) ny = 0;

            // EXPONENTIAL CURVE (Quadratic) for finer control
            // Sign * Value^2
            vectorOut.x = Math.sign(nx) * nx * nx;
            vectorOut.y = Math.sign(ny) * ny * ny;
        };

        const resetStick = (knob, vectorOut) => {
            vectorOut.x = 0;
            vectorOut.y = 0;
            knob.style.transform = `translate(-50%, -50%)`;
        };

        // LEFT STICK
        this.leftZone.addEventListener('touchstart', (e) => handleStick(e, this.leftZone, this.leftKnob, this.moveVector), { passive: false });
        this.leftZone.addEventListener('touchmove', (e) => handleStick(e, this.leftZone, this.leftKnob, this.moveVector), { passive: false });
        this.leftZone.addEventListener('touchend', (e) => resetStick(this.leftKnob, this.moveVector), { passive: false });

        // RIGHT STICK
        this.rightZone.addEventListener('touchstart', (e) => handleStick(e, this.rightZone, this.rightKnob, this.lookVector), { passive: false });
        this.rightZone.addEventListener('touchmove', (e) => handleStick(e, this.rightZone, this.rightKnob, this.lookVector), { passive: false });
        this.rightZone.addEventListener('touchend', (e) => resetStick(this.rightKnob, this.lookVector), { passive: false });

        // BUTTONS
        this._bindBtn(this.jumpBtn, () => this.shouldJump = true, () => this.shouldJump = false);
        this._bindBtn(this.fireBtn, () => this.isFiring = true, () => this.isFiring = false);
        this._bindBtn(this.altBtn, () => this.isAltFiring = true, () => this.isAltFiring = false); // BIND ALT
        this._bindBtn(this.weaponBtn, () => this.shouldSwap = true, () => { });
    }

    _bindBtn(btn, onStart, onEnd) {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); onStart(); btn.style.transform = "scale(0.9)"; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); onEnd(); btn.style.transform = "scale(1.0)"; });
    }

    show() {
        this.active = true;
        this.container.style.display = 'block';
    }

    hide() {
        this.active = false;
        this.container.style.display = 'none';
        this.reset();
    }

    enableCombatMode() {
        this.fireBtn.style.display = 'flex';
        this.altBtn.style.display = 'flex'; // SHOW ALT
        this.weaponBtn.style.display = 'flex';
    }

    disableCombatMode() {
        this.fireBtn.style.display = 'none';
        this.altBtn.style.display = 'none';
        this.weaponBtn.style.display = 'none';
        this.isFiring = false;
        this.isAltFiring = false;
    }

    reset() {
        this.moveVector = { x: 0, y: 0 };
        this.lookVector = { x: 0, y: 0 };
        this._handleStickEnd(this.leftKnob, this.moveVector);
        this._handleStickEnd(this.rightKnob, this.lookVector);
        this.isFiring = false;
        this.isAltFiring = false; // RESET ALT
        this.shouldJump = false;
        this.shouldSwap = false;
    }

    _handleStickEnd(knob, vector) {
        if (vector) { vector.x = 0; vector.y = 0; }
        if (knob) knob.style.transform = `translate(-50%, -50%)`;
    }

    getJump() {
        const jump = this.shouldJump;
        this.shouldJump = false;
        return jump;
    }

    getFire() {
        return this.isFiring;
    }

    getAltFire() {
        return this.isAltFiring;
    }

    getSwap() {
        const swap = this.shouldSwap;
        this.shouldSwap = false;
        return swap;
    }
}
