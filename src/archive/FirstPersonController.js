import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

import { MobileControls } from './MobileControls.js';

export class FirstPersonController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.controls = new PointerLockControls(camera, domElement);
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        
        // Advanced Movement State
        this.isSprinting = false;
        this.isJumping = false;
        this.canJump = true;
        this.stamina = 100;
        this.maxStamina = 100;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.speed = 30.0;
        this.isLocked = false;

        // Mobile support
        this.mobileControls = null;
        if (window.innerWidth <= 900) { // Simple mobile check
            this.mobileControls = new MobileControls(document.body);
            console.log("Mobile Controls Initialized");
        }

        this._setupListeners();
    }

    _setupListeners() {
        this.controls.addEventListener('lock', () => this.isLocked = true);
        this.controls.addEventListener('unlock', () => this.isLocked = false);

        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));
    }

    enableMobile() {
        if (this.mobileControls) this.mobileControls.show();
    }

    disableMobile() {
        if (this.mobileControls) this.mobileControls.hide();
    }

    _onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.moveForward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.moveLeft = true; break;
            case 'ArrowDown':
            case 'KeyS': this.moveBackward = true; break;
            case 'ArrowRight':
            case 'KeyD': this.moveRight = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.isSprinting = true; break;
            case 'Space': this._tryJump(); break;
        }
    }

    _onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.moveForward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.moveLeft = false; break;
            case 'ArrowDown':
            case 'KeyS': this.moveBackward = false; break;
            case 'ArrowRight':
            case 'KeyD': this.moveRight = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.isSprinting = false; break;
        }
    }

    _tryJump() {
        if (this.canJump) {
            this.velocity.y += 18.0; // Jump Force
            this.canJump = false;
            if (this.onJump) this.onJump();
        }
    }

    lock() {
        if (this.mobileControls) {
            // On mobile, "locking" just means showing controls
            this.enableMobile();
            this.isLocked = true; // Fake lock state
        } else {
            this.controls.lock();
        }
    }

    unlock() {
        if (this.mobileControls) {
            this.disableMobile();
            this.isLocked = false;
        } else {
            this.controls.unlock();
        }
    }

    update(delta) {
        if (!this.isLocked) return;

        // Frictional deceleration
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 45.0 * delta; // Gravity

        // Input Gathering
        let inputZ = Number(this.moveForward) - Number(this.moveBackward);
        let inputX = Number(this.moveRight) - Number(this.moveLeft);

        // Merge Mobile Input
        if (this.mobileControls && this.mobileControls.active) {
            const mVec = this.mobileControls.moveVector;
            // Joystick Y is usually strictly up/down. 
            // -1 is Up (Forward), 1 is Down (Back) in screen coords usually?
            // Wait, standard joystick: Up is Y < 0 usually in DOM, but my calc uses (touch - center).
            // (touchY - centerY): Up is Negative.
            // moveForward needs +1 for direction vector?
            // Let's check logic: direction.z = forward - backward.
            // If I push UP, Y is Negative. I want Forward (+1). So -Y.

            if (Math.abs(mVec.y) > 0.1) inputZ -= mVec.y; // Invert Y for forward
            if (Math.abs(mVec.x) > 0.1) inputX += mVec.x;

            // Handle Look (Twin Stick)
            const look = this.mobileControls.lookVector;
            if (look.x !== 0 || look.y !== 0) {
                // DOOM STYLE CONTROLS
                // FAST Turning (Yaw)
                const yawSpeed = 4.0; // Much faster as requested
                this.camera.rotation.y -= look.x * yawSpeed * delta;

                // LOCKED Vertical (Pitch)
                // User requested "lock vertical axis to straight line"
                // We ignore stick Y for look, and instead auto-level the camera.
                this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, 0, 10 * delta);
            } else {
                // Even if not touching, auto-level just in case
                if (Math.abs(this.camera.rotation.x) > 0.01) {
                    this.camera.rotation.x = THREE.MathUtils.lerp(this.camera.rotation.x, 0, 5 * delta);
                }
            }

            // Handle Jump
            if (this.mobileControls.getJump()) {
                this._tryJump();
            }
        }

        // Stamina Logic
        const isMoving = Math.abs(inputZ) > 0.1 || Math.abs(inputX) > 0.1;
        if (this.isSprinting && isMoving && this.stamina > 0) {
            this.stamina = Math.max(0, this.stamina - 25 * delta);
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 15 * delta);
        }

        // Sprint Speed Multiplier
        let currentSpeed = this.speed;
        if (this.isSprinting && this.stamina > 0 && isMoving) {
            currentSpeed *= 2.2; // Buffed sprint speed
        }

        this.direction.z = inputZ;
        this.direction.x = inputX;
        this.direction.normalize(); // This might kill analog magnitude? 
        // If I want analog speed, I shouldn't normalize blindly if magnitude < 1.
        // But for consistency let's leave it normalized for now, otherwise diagonal is faster.
        // Valid improvement: restrict magnitude to 1.

        if (inputZ || inputX) {
            this.velocity.z -= this.direction.z * currentSpeed * 10.0 * delta;
            this.velocity.x -= this.direction.x * currentSpeed * 10.0 * delta;
        }

        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        
        // Vertical movement (Jumping/Gravity)
        this.camera.position.y += this.velocity.y * delta;

        if (this.camera.position.y < 10) {
            this.velocity.y = 0;
            this.camera.position.y = 10;
            this.canJump = true;
        }
    }
}
