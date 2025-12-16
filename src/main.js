import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { flowVertexShader, flowFragmentShader } from './viewer/shaders.js';

export class CrystalViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return; // Silent fail if container missing (e.g. passive mode)

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.crystalGroup = null; // Holds mesh+wireframe
      this.autoRotate = true;
      this.animationId = null;
    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: 1.5 } // Drastically reduced from 8.0
    };

      this.init();
    }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x050810, 0.02);

      // Camera
      const aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 2000); // 50 FOV for tighter look
      this.camera.position.set(30, 20, 30);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.container.appendChild(this.renderer.domElement);

      // Controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 2.0;

      // Environment
      this.buildEnvironment();

      // Resize Listener
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);

      // Start Loop
      this.animate();
    }

  buildEnvironment() {
    // Grid
    const gridHelper = new THREE.GridHelper(200, 100, 0x00f3ff, 0x003344);
    gridHelper.position.y = -10;
    this.scene.add(gridHelper);

      // Lights
      const ambient = new THREE.AmbientLight(0x404040);
      this.scene.add(ambient);

    const light1 = new THREE.PointLight(0x00f3ff, 2, 100);
    light1.position.set(0, 20, 0);
    this.scene.add(light1);

    const light2 = new THREE.PointLight(0xff0055, 1, 100);
    light2.position.set(40, -10, 40);
    this.scene.add(light2);
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
        const { meshResult, stats } = this.parsePLY(buffer);

        this.crystalGroup = meshResult;
        this.scene.add(this.crystalGroup);

        // TIGHT ZOOM Logic
        this.fitCameraToSelection();

        return stats;
      } catch (err) {
        console.error("Load failed:", err);
        throw err;
      }
    }

  fitCameraToSelection() {
    if (!this.crystalGroup) return;

      const box = new THREE.Box3().setFromObject(this.crystalGroup);
      if (box.isEmpty()) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Find max dimension (usually Y for towers)
      const maxDim = Math.max(size.x, size.y, size.z);

      // Calculate Distance
      // We want the object to fill ~85% of screen
      // tan(fov/2) = (height/2) / dist
      // dist = (height/2) / tan(fov/2)
      const fovRad = this.camera.fov * (Math.PI / 180);
      let cameraDist = (maxDim / 2) / Math.tan(fovRad / 2);

      cameraDist *= 1.4; // 1.4 multiplier = tight fit (was 2.5)

      // Reset controls target
      this.controls.target.copy(center);

      // Position camera Isometrically (-ish) relative to center
      // Keep consistent angle
      const direction = new THREE.Vector3(1, 0.6, 1).normalize();
      const pos = center.clone().add(direction.multiplyScalar(cameraDist));

      this.camera.position.copy(pos);
      this.controls.update();
    }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    if (this.controls) this.controls.autoRotate = enabled;
  }

  resetView() {
    this.fitCameraToSelection();
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Update Uniforms
    this.uniforms.uTime.value += 0.01;

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  parsePLY(buffer) {
    // ... (Same parsing logic as before, wrapped in class method) ...
    const decoder = new TextDecoder();
    // findHeaderEnd helper inline
    let headerEndIndex = 0;
    const chunk = decoder.decode(buffer.slice(0, 2048));
    const idx = chunk.indexOf("end_header\n");
    if (idx !== -1) headerEndIndex = idx + "end_header\n".length;

      const headerText = decoder.decode(buffer.slice(0, headerEndIndex));
      const body = buffer.slice(headerEndIndex);

      const vertexCount = parseInt(headerText.match(/element vertex (\d+)/)?.[1] || 0);
      const edgeCount = parseInt(headerText.match(/element edge (\d+)/)?.[1] || 0);

      const textData = decoder.decode(body).trim().split(/\s+/);
      let ptr = 0;

      const positions = [];
      const colors = [];
      const edgeIndices = [];

      for (let i = 0; i < vertexCount; i++) {
        const x = parseFloat(textData[ptr++]);
        const y = parseFloat(textData[ptr++]);
        const z = parseFloat(textData[ptr++]);
        const r = parseInt(textData[ptr++]) / 255;
        const g = parseInt(textData[ptr++]) / 255;
        const b = parseInt(textData[ptr++]) / 255;
        positions.push(x, y, z);
        colors.push(r, g, b);
        }

      for (let i = 0; i < edgeCount; i++) {
        const v1 = parseInt(textData[ptr++]);
        const v2 = parseInt(textData[ptr++]);
        edgeIndices.push(v1, v2);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.center(); // Center local geometry

      // Parent Group to hold mesh + wireframe
      const group = new THREE.Group();

      // Points
    // Points (Shader)
    const pointMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: flowVertexShader,
      fragmentShader: flowFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false // Improves glass sorting
      });
      const mesh = new THREE.Points(geometry, pointMaterial);
      group.add(mesh);

      // Lines
      if (edgeIndices.length > 0) {
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute('position', geometry.getAttribute('position'));
        lineGeometry.setIndex(edgeIndices);

          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending
          });
          const wireframe = new THREE.LineSegments(lineGeometry, lineMaterial);
          group.add(wireframe);
        }

      return {
        meshResult: group,
        stats: {
          nodes: vertexCount,
          links: edgeCount,
          layers: 10 // Mock or calculate
        }
    };
  }
}
