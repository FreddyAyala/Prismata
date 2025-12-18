import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraRig {
  constructor(camera, renderer, container) {
    this.camera = camera;
    this.renderer = renderer;
    this.container = container;
    this.controls = null;
    this.autoRotate = true;
  }

  init() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 2.0;
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    if (this.controls) this.controls.autoRotate = enabled;
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
    if (this.controls) this.controls.update();
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
