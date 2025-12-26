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
      uPulseEnabled: { value: 0.0 }, // Flow OFF by default
      // Advanced Uniforms (Setters will update these)
      uNodeDensity: { value: 1.0 },
      uLineDensity: { value: 1.0 },
      uLineDist: { value: 200.0 }, // Default far (Infinite-ish)
      uNodeDist: { value: 200.0 },
      uThinning: { value: 0.0 },
      uXorDensity: { value: 0.0 },
      uLFO: { value: 0.0 },
      // Neural Focus (Cortex)
      uFocus: { value: new THREE.Vector3(0, 0, 0) },
      uFocusStr: { value: 0.0 }
    };

    // LERP Targets for Smooth Transitions
    this.targetUniforms = {
      uNodeDensity: 1.0,
      uLineDensity: 1.0,
      uLineDist: 200.0, // Match above
      uNodeDist: 200.0,
      uThinning: 0.0,
      uXorDensity: 0.0,
      uLFO: 0.0
    };

    // FPS Tracking
    this.fpsLastTime = performance.now();
    this.fpsFrames = 0;
    this.fpsElement = document.getElementById('fps-counter');

    // Easter Egg System
    this.arena = null;

    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: 0.2 }
    };

    this.baseNodeSize = 0.15; // Default
    this.isHorizontal = false; // PERSIST: Horizontal Loop State

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

      // Apply Base Size
      const points = this.crystalGroup.children.find(c => c.isPoints);
      if (points && points.material) {
        points.material.size = this.baseNodeSize;
      }

      // RE-APPLY ORIENTATION (Fix Persistence)
      this.setOrientation(this.isHorizontal, false); // False = No re-fit yet

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

  setOrientation(isHorizontal, fitToBox = true) {
    this.isHorizontal = isHorizontal; // Save State

    if (this.crystalGroup) {
      // Rotate 90 degrees on Z to make it horizontal
      // Target: -PI/2 (90 deg clockwise) so top becomes right
      const targetAll = isHorizontal ? -Math.PI / 2 : 0;

      // Check if we want to animate this? For now, direct set.
      this.crystalGroup.rotation.z = targetAll;

      // Re-center/Fit
      if (fitToBox) this.resetView();
    }
  }

  onResize() {
    this.rig.onResize();
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // 1. FPS Calculation
    this.fpsFrames++;
    const time = performance.now();
    if (time >= this.fpsLastTime + 1000) {
      const fps = Math.round((this.fpsFrames * 1000) / (time - this.fpsLastTime));
      if (this.fpsElement) this.fpsElement.innerText = `FPS: ${fps}`;

      // Dispatch Event for UI/Governor
      window.dispatchEvent(new CustomEvent('fps-update', { detail: { fps } }));

      this.fpsLastTime = time;
      this.fpsFrames = 0;
    }

    // 2. Uniform LERP (Smooth Transitions)
    if (this.customUniforms && this.targetUniforms) {
      this.customUniforms.uTime.value += 0.01;

      // Lerp helper
      const lerp = (start, end, amt) => (1 - amt) * start + amt * end;
      const alpha = 0.05;

      this.customUniforms.uNodeDensity.value = lerp(this.customUniforms.uNodeDensity.value, this.targetUniforms.uNodeDensity, alpha);
      this.customUniforms.uLineDensity.value = lerp(this.customUniforms.uLineDensity.value, this.targetUniforms.uLineDensity, alpha);

      // Missing LERPs added:
      this.customUniforms.uLineDist.value = lerp(this.customUniforms.uLineDist.value, this.targetUniforms.uLineDist, alpha);
      this.customUniforms.uNodeDist.value = lerp(this.customUniforms.uNodeDist.value, this.targetUniforms.uNodeDist, alpha);
      this.customUniforms.uThinning.value = lerp(this.customUniforms.uThinning.value, this.targetUniforms.uThinning, alpha);
      this.customUniforms.uXorDensity.value = lerp(this.customUniforms.uXorDensity.value, this.targetUniforms.uXorDensity, alpha);

      if (this.customUniforms.uLFO && this.targetUniforms.uLFO !== undefined) {
        this.customUniforms.uLFO.value = lerp(this.customUniforms.uLFO.value, this.targetUniforms.uLFO, alpha);
      }

      // Focus Decay (Auto fade out thought)
      if (this.customUniforms.uFocusStr && this.customUniforms.uFocusStr.value > 0.001) {
        this.customUniforms.uFocusStr.value *= 0.98; // Medium Decay (2% per frame)
      }
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

  // Visual Setters for Governor/UI
  setNodeDensity(val) {
    if (this.targetUniforms) this.targetUniforms.uNodeDensity = val;
  }

  setLineDensity(val) {
    if (this.targetUniforms) this.targetUniforms.uLineDensity = val;
  }

  setPanSpeed(val) {
    if (this.rig) {
      // Update both rig property and controls property if applicable
      this.rig.panSpeed = val;
      if (this.rig.controls) this.rig.controls.panSpeed = val;
    }
  }



  toggleAutoPan(enabled) {
    if (this.rig) {
      this.rig.autoPan = enabled;
    }
  }

  // --- Advanced Control Setters ---

  setRotSpeed(val) {
    if (this.rig && this.rig.controls) {
      this.rig.controls.autoRotateSpeed = val;
    }
  }

  setManualHeight(val) {
    if (this.rig && this.rig.camera) {
      // Offset camera Y relative to target
      // This is tricky in OrbitControls, usually we move camera.position.y
      // maintaining distance?
      // Simple approach: Adjust Y directly.
      this.rig.camera.position.y = val;
      this.rig.controls.update();
    }
  }

  setPanMin(val) {
    if (this.rig) this.rig.panMin = val;
  }

  setPanMax(val) {
    if (this.rig) this.rig.panMax = val;
  }

  setBaseSize(val) {
    this.baseNodeSize = val;
    if (this.crystalGroup) {
      const points = this.crystalGroup.children.find(c => c.isPoints);
      if (points && points.material) {
        points.material.size = val;
      }
    }
  }

  setLFOAmount(val) {
    if (this.targetUniforms) {
      this.targetUniforms.uLFO = val;
    }
  }

  setXorDensity(val) {
    if (this.targetUniforms) this.targetUniforms.uXorDensity = val;
  }

  setLineDist(val) {
    if (this.targetUniforms) this.targetUniforms.uLineDist = val;
  }

  setNodeDist(val) { // Maps to line-dist or separate? Controls.js has line-dist only? Controls loop has node-density/line-density.
    if (this.targetUniforms) this.targetUniforms.uNodeDist = val;
  }

  setThinning(val) {
    if (this.targetUniforms) this.targetUniforms.uThinning = val;
  }

  setFocus(vector, strength = 1.0) {
    if (!this.customUniforms) return;
    // vector is {x,y,z}
    this.customUniforms.uFocus.value.set(vector.x, vector.y, vector.z);

    // Animate Strength: Pop to 1, then slowly fade?
    // Or just set it.
    this.customUniforms.uFocusStr.value = strength;

    // Auto-fadeout mechanic could go in animate loop or here via tween
    // For now, let's keep it manual or decay in loop if we want.
  }

  clearFocus() {
    if (this.customUniforms) {
      this.customUniforms.uFocusStr.value = 0.0;
    }
  }
}
