import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraRig {
  constructor(camera, renderer, container) {
    this.camera = camera;
    this.renderer = renderer;
    this.container = container;
    this.controls = null;
    this.autoRotate = true;

    // Auto Pan State
    this.autoPan = false;
    this.panSpeed = 0.5;
    this.panMin = -5;
    this.panMax = 10;
  }

  init() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 2.0;
  }

  setAutoRotate(enabled) {
    console.log("CameraRig: setAutoRotate", enabled);
    this.autoRotate = enabled;
    if (this.controls) {
      this.controls.autoRotate = enabled;
      // Kill momentum immediately if stopping
      if (!enabled) {
        this.controls.enableDamping = false;
        this.controls.update(); // Apply "no damping" frame to stop drift
        this.controls.enableDamping = true; // Re-enable for mouse usage
      }
    }
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  update() {
    if (this.controls) {
      // Sync autoRotate state to be absolutely sure
      if (this.controls.autoRotate !== this.autoRotate) {
        console.warn("Syncing controls.autoRotate to", this.autoRotate);
        this.controls.autoRotate = this.autoRotate;
      }

      this.controls.update();

      // Auto Pan Logic (Vertical Scanning)
      if (this.autoPan) {
        // Initialize phase state if missing
        if (this._panPhase === undefined) this._panPhase = 0;
        if (this._lastTime === undefined) this._lastTime = performance.now();

        const now = performance.now();
        const dt = (now - this._lastTime) * 0.001;
        this._lastTime = now;

        const speed = this.panSpeed || 0.5;
        // Accumulate phase based on current speed
        this._panPhase += dt * speed;

        const min = (typeof this.panMin === 'number') ? this.panMin : -10;
        const max = (typeof this.panMax === 'number') ? this.panMax : 40;
        const range = (max - min) / 2;
        const center = (max + min) / 2;

        // Pan target.y using accumulated phase
        const newY = center + Math.sin(this._panPhase) * range;

        // maintain relative camera height
        const deltaY = newY - this.controls.target.y;
        this.controls.target.y = newY;
        this.camera.position.y += deltaY;
      } else {
        // Reset timing state when disabled so it doesn't jump on resume
        this._lastTime = undefined;
      }
    }
  }

  fitToBox(box) {
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);

    const fovRad = this.camera.fov * (Math.PI / 180);
    let cameraDist = (maxDim / 2) / Math.tan(fovRad / 2);

    cameraDist *= 1.4; 

    // Reset controls target
    if (this.controls) {
        this.controls.target.copy(center);
    }

    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    const pos = center.clone().add(direction.multiplyScalar(cameraDist));

    this.camera.position.copy(pos);
    this.controls.update();
  }
}
