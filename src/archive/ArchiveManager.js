import * as THREE from 'three';
import { ArchiveEnvironment } from './ArchiveEnvironment.js';
import { FirstPersonController } from './FirstPersonController.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

class ArchiveManager {
    constructor() {
        this.active = false;
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.environment = null;
        this.animationId = null;
        this.clock = new THREE.Clock();
        this.models = [];
        this.exhibits = [];
    }

    init(containerId) {
        // Create container if not exists
        let div = document.getElementById(containerId);
        if (!div) {
            div = document.createElement('div');
            div.id = containerId;
            div.className = 'archive-container hidden';
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.width = '100vw';
            div.style.height = '100vh';
            div.style.zIndex = '3000'; // Top most
            div.style.background = '#000';
            document.body.appendChild(div);

            // UI Overlay
            const ui = document.createElement('div');
            ui.id = 'archive-ui';
            ui.style.position = 'absolute';
            ui.style.top = '0';
            ui.style.left = '0';
            ui.style.width = '100%';
            ui.style.height = '100%';
            ui.style.cursor = 'pointer'; // Show it's clickable
            ui.innerHTML = `
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:#00ff88; font-family:'Orbitron', sans-serif;">
                    <h1 style="font-size:3rem; margin-bottom:10px; text-shadow:0 0 20px #00ff88;">ARCHIVE ACCESS</h1>
                    <p style="pointer-events:none;">CLICK ANYWHERE TO ENTER</p>
                    <div style="margin-top:20px; font-size:0.8rem; opacity:0.7;">WASD TO MOVE | MOUSE TO LOOK | ESC TO DISCONNECT</div>
                </div>
            `;
            div.appendChild(ui);

            // Interaction: Bind click to the UI layer specifically
            ui.addEventListener('click', () => {
                if (this.active && this.player && !this.player.isLocked) {
                    this.player.lock();
                    ui.style.opacity = 0;
                }
            });
        }
        this.container = div;
    }

    enterArchive(models) {
        this.active = true;
        this.models = models;
        this.container.classList.remove('hidden');

        // Setup THREE
        this.setupScene();

        // Start Loop
        this.animate();
    }

    exitArchive() {
        this.active = false;
        this.container.classList.add('hidden');
        cancelAnimationFrame(this.animationId);

        if (this.player) this.player.unlock();

        // Clean up WebGL to save memory
        this.cleanup();

        // Trigger Callback
        if (this.onExit) this.onExit();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a); // Dark gray

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 10, 50);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.container.appendChild(this.renderer.domElement);

        this.environment = new ArchiveEnvironment(this.scene);
        this.environment.build(Math.max(200, this.models.length * 50));

        this.player = new FirstPersonController(this.camera, document.body); // Bind to body for pointer lock

        // Unlock Listener to Show Menu
        this.player.controls.addEventListener('unlock', () => {
            const ui = document.getElementById('archive-ui');
            if (ui) {
                ui.style.opacity = 1;
                ui.innerHTML = `
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:#ff0055; font-family:'Orbitron', sans-serif;">
                        <h1>CONNECTION PAUSED</h1>
                        <button id="btn-archive-resume" style="background:transparent; border:1px solid #00ff88; color:#00ff88; padding:10px 30px; margin:10px; cursor:pointer;">RESUME</button>
                        <button id="btn-archive-exit" style="background:transparent; border:1px solid #ff0055; color:#ff0055; padding:10px 30px; margin:10px; cursor:pointer;">DISCONNECT</button>
                    </div>
                `;

                document.getElementById('btn-archive-resume').addEventListener('click', () => {
                    this.player.lock();
                    ui.style.opacity = 0;
                });

                document.getElementById('btn-archive-exit').addEventListener('click', () => {
                    this.exitArchive();
                });
            }
        });

        // Add Placeholders for Models
        this.setupExhibits();

        this.resizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this.resizeHandler);
    }

    setupExhibits() {
        // Simple pedestals for now
        const loader = new PLYLoader();
        let zPos = 0;

        this.models.forEach((model, i) => {
            zPos -= 50;
            const isLeft = i % 2 === 0;
            const xPos = isLeft ? -30 : 30;

            // Color Code
            let colorHex = 0x00f3ff; // Default Cyan
            if (model.type === 'LLM') colorHex = 0xff0055; // Red
            if (model.type === 'Multimodal') colorHex = 0xffaa00; // Orange
            if (model.type === 'Vision') colorHex = 0xaa00ff; // Purple

            // Pedestal
            const geometry = new THREE.BoxGeometry(10, 2, 10);
            const material = new THREE.MeshStandardMaterial({
                color: 0x111111,
                emissive: colorHex,
                emissiveIntensity: 0.2,
                roughness: 0.2,
                metalness: 0.8
            });
            const box = new THREE.Mesh(geometry, material);
            box.position.set(xPos, 1, zPos);
            this.scene.add(box);

            // Dynamic Light (Vibrant Glow)
            const light = new THREE.PointLight(colorHex, 1.5, 40);
            light.position.set(xPos, 8, zPos);
            this.scene.add(light);

            // Text Label
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 128;
            ctx.fillStyle = '#' + new THREE.Color(colorHex).getHexString();
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(model.name.toUpperCase(), 256, 64);
            ctx.font = '24px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(model.year, 256, 100);

            const tex = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(xPos, 7, zPos);
            sprite.scale.set(10, 2.5, 1);
            this.scene.add(sprite);

            // Store for proximity loading
            this.exhibits.push({
                model: model,
                position: new THREE.Vector3(xPos, 10, zPos),
                loaded: false,
                color: colorHex
            });
        });
    }

    cleanup() {
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer = null;
        }
        this.scene = null;
        this.player = null;

        // Remove Listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
    }

    animate() {
        if (!this.active) return;
        this.animationId = requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        if (this.player) {
            this.player.update(delta);
            this.checkProximity();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    checkProximity() {
        // Optimization: Don't check every frame if many models
        if (!this.player) return;
        const playerPos = this.camera.position;

        this.exhibits.forEach(exhibit => {
            const dist = playerPos.distanceTo(exhibit.position);

            if (dist < 150 && !exhibit.loaded) {
                // LOAD
                exhibit.loaded = true; // Mark immediately to prevent double load
                this.loadArtifact(exhibit);
            } else if (dist > 200 && exhibit.loaded && exhibit.mesh) {
                // UNLOAD (Optional, to save memory)
                this.scene.remove(exhibit.mesh);
                if (exhibit.mesh.geometry) exhibit.mesh.geometry.dispose();
                if (exhibit.mesh.material) exhibit.mesh.material.dispose();
                exhibit.mesh = null;
                exhibit.loaded = false;
            }
        });
    }

    loadArtifact(exhibit) {
        const model = exhibit.model;
        if (!model.crystals || !model.crystals.length) return;

        const file = model.crystals[0].file;
        const loader = new PLYLoader();

        loader.load('./' + file, (geometry) => {
            geometry.computeVertexNormals();
            // Center geometry
            geometry.center();

            // Color based on type
            let color = 0x00f3ff;
            if (model.type === 'LLM') color = 0xff0055;
            if (model.type === 'Multimodal') color = 0xffaa00;

            // Standard Material
            const material = new THREE.PointsMaterial({
                color: color,
                size: 0.15,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });

            const mesh = new THREE.Points(geometry, material);
            mesh.position.copy(exhibit.position);
            mesh.position.y += 2; // Float above pedestal

            // Interaction: Rotate
            mesh.onBeforeRender = () => {
                mesh.rotation.y += 0.005;
            };

            this.scene.add(mesh);
            exhibit.mesh = mesh;
        });
    }

    onResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
}

export const archiveManager = new ArchiveManager();
