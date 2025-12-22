import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

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

        this._setupListeners();
    }

    _setupListeners() {
        this.controls.addEventListener('lock', () => this.isLocked = true);
        this.controls.addEventListener('unlock', () => this.isLocked = false);

        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        document.addEventListener('keyup', (e) => this._onKeyUp(e));
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
            case 'Space':
                if (this.canJump) {
                    this.velocity.y += 18.0; // Jump Force
                    this.canJump = false;
                    if (this.onJump) this.onJump();
                }
                break;
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

    lock() {
        this.controls.lock();
    }

    unlock() {
        this.controls.unlock();
    }

    update(delta) {
        if (!this.isLocked) return;

        // Frictional deceleration
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 45.0 * delta; // Gravity

        // Stamina Logic
        const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
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

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * currentSpeed * 10.0 * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * currentSpeed * 10.0 * delta;

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
