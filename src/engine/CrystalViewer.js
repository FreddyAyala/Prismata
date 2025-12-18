import { LightCycleArena } from '../easterEgg.js';
import { PLYParser } from './PLYParser.js';
import { Environment } from './Environment.js';
import { CameraRig } from './CameraRig.js';
import * as THREE from 'three';

export class CrystalViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.renderer = null;
    this.crystalGroup = null;
    this.animationId = null;

    // Sub-systems
    this.environment = null;
    this.rig = null;
    this.arena = null;

    // Pulse Uniforms
    this.customUniforms = {
      uTime: { value: 0 },
      uPulseEnabled: { value: 0.0 }
    };

    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: 0.2 }
    };

    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x050810, 0.02);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Camera Rig (Camera + Controls)
    const aspect = this.container.clientWidth / this.container.clientHeight;
    // Camera creation could be inside Rig, but often we want ref here.
    // Let's create camera here and pass to Rig as per Rig design.
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000);
    camera.position.set(30, 20, 30);

    this.rig = new CameraRig(camera, this.renderer, this.container);
    this.rig.init();

    // Environment
    this.environment = new Environment(this.scene);
    this.environment.build();

    // Init Arena (Start Disabled)
    this.arena = new LightCycleArena(this.scene);

    // Resize Listener
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    // Start Loop
    this.animate();
  }

  async loadCrystal(url) {
    // Cleanup old
    if (this.crystalGroup) {
      this.scene.remove(this.crystalGroup);
      this.crystalGroup.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.crystalGroup = null;
    }

    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const { meshResult, stats } = PLYParser.parse(buffer, this.customUniforms);

      this.crystalGroup = meshResult;
      this.scene.add(this.crystalGroup);

      // TIGHT ZOOM Logic via Rig
      const box = new THREE.Box3().setFromObject(this.crystalGroup);
      this.rig.fitToBox(box);

      return stats;
    } catch (err) {
      console.error("Load failed:", err);
      throw err;
    }
  }

  setAutoRotate(enabled) {
    this.rig.setAutoRotate(enabled);
  }

  resetView() {
    if (this.crystalGroup) {
      const box = new THREE.Box3().setFromObject(this.crystalGroup);
      this.rig.fitToBox(box);
    }
  }

  onResize() {
    this.rig.onResize();
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Update Pulse Uniforms
    if (this.customUniforms) {
      this.customUniforms.uTime.value += 0.01;
    }

    // Easter Egg
    if (this.arena) this.arena.update();

    // Rig Update
    if (this.rig) this.rig.update();

    if (this.renderer && this.scene && this.rig.camera) {
      this.renderer.render(this.scene, this.rig.camera);
    }
  }

  toggleEasterEgg() {
    if (this.arena) {
      this.arena.toggle();
      return this.arena.active;
    }
    return false;
  }

  setPulse(enabled) {
    if (this.customUniforms) {
      this.customUniforms.uPulseEnabled.value = enabled ? 1.0 : 0.0;
    }
  }
}
