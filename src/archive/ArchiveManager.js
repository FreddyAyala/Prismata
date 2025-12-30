import * as THREE from 'three';
import { ArchiveEnvironment } from './ArchiveEnvironment.js';
import { FirstPersonController } from './FirstPersonController.js';
import { GoomGame } from './goom/GoomGame.js';
// HMR FORCE UPDATE - DOOM V8 (WIDTH 150)
console.log("ArchiveManager Loaded - Force Update V8 (GOOM)");
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
        }

        // Always update UI to ensure FPS counter exists (HMR friendly)
        div.innerHTML = ''; // Clear existing

        // 1. HUD Layer (FPS) - Always Visible
        const hud = document.createElement('div');
        hud.id = 'archive-ui-hud';
        hud.style.position = 'absolute';
        hud.style.top = '0';
        hud.style.left = '0';
        hud.style.width = '100%';
        hud.style.height = '100%';
        hud.style.pointerEvents = 'none'; // Passthrough
        hud.style.zIndex = '3002'; // Above overlay

        hud.innerHTML = `
            <div style="position:absolute; top:20px; left:20px; color:#00ff88; font-family:'Orbitron', monospace; font-size:14px;">
                FPS: <span id="archive-fps">--</span>
            </div>
        `;
        div.appendChild(hud);

        // 2. Menu Overlay (Title/Instructions) - Fades Out
        const overlay = document.createElement('div');
        overlay.id = 'archive-ui-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.cursor = 'pointer'; // Show it's clickable
        overlay.style.zIndex = '3001';

        const isMobile = window.innerWidth <= 900;
        const titleText = isMobile ? "ARCHIVE ACCESS" : "ARCHIVE ACCESS";
        const subText = isMobile ? "TAP TO CONNECT" : "CLICK ANYWHERE TO ENTER";
        const instrText = isMobile ? "USE VIRTUAL JOYSTICK TO MOVE" : "WASD TO MOVE | MOUSE TO LOOK | ESC TO DISCONNECT";

        overlay.innerHTML = `
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:#00ff88; font-family:'Orbitron', sans-serif;">
                <h1 style="font-size:3rem; margin-bottom:10px; text-shadow:0 0 20px #00ff88;">${titleText}</h1>
                <p style="pointer-events:none;">${subText}</p>
                <div style="margin-top:20px; font-size:0.8rem; opacity:0.7;">${instrText}</div>
            </div>
        `;
        div.appendChild(overlay);

        // Interaction: Bind click to the OVERLAY layer specifically
        overlay.addEventListener('click', (e) => {
            if (this.active && this.player && !this.player.isLocked) {
                this.player.lock(); // On mobile this enables overlay
                overlay.style.opacity = 0;
                overlay.style.pointerEvents = 'none'; // Prevent blocking
            }
        });

        this.container = div;
    }

    enterArchive(models) {
        this.active = true;
        this.models = models;
        this.container.classList.remove('hidden');

        // Find FPS Element if not set
        this.fpsElement = document.getElementById('archive-fps');
        this.fpsFrames = 0;
        this.fpsLastTime = performance.now();

        // Setup THREE
        this.setupScene();

        // Start Loop
        this.animate();
    }

    // ... existing initialization ...

    animate() {
        if (!this.active) return;
        this.animationId = requestAnimationFrame(() => this.animate());

        // FPS Calculation
        const time = performance.now();
        this.fpsFrames++;
        if (time >= this.fpsLastTime + 1000) {
            const fps = Math.round((this.fpsFrames * 1000) / (time - this.fpsLastTime));
            if (this.fpsElement) this.fpsElement.innerText = fps;
            this.fpsFrames = 0;
            this.fpsLastTime = time;
        }

        const delta = this.clock.getDelta();
        if (this.player) {
            this.player.update(delta);
            this.checkProximity();

            // Perform Goom Trigger Check
            const p = this.camera.position;
            // Check distance to platform (35, 0, 10)
            if (Math.abs(p.x - 35) < 4 && Math.abs(p.z - 10) < 4) {
                if (!this.goomManager.active) {
                    this.goomManager.activate(this.exhibits);
                    if (this.environment && this.environment.secretIcon) {
                        this.environment.secretIcon.visible = false;
                    }
                }
            }
        }

        if (this.goomManager) {
            try {
                this.goomManager.update(delta);
            } catch (e) {
                console.error("GoomManager update error:", e);
            }
        }

        if (this.environment && this.environment.update) {
            this.environment.update(delta);
        }

        // Update Crystal Rotations
        if (this.rotatingExhibits && this.rotatingExhibits.length > 0) {
            this.rotatingExhibits.forEach(mesh => {
                mesh.rotation.y += 0.5 * delta;
            });
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    checkProximity() {
        if (!this.player) return;
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
            if (!this.scene) return; // Prevent race condition if cleaned up

            geometry.computeVertexNormals();
            // Center geometry
            geometry.center();

            // Color based on type
            let color = 0x00f3ff;
            if (model.type === 'LLM') color = 0xff0055;
            if (model.type === 'Multimodal') color = 0xffaa00;
            if (model.type === 'Vision') color = 0xaa00ff;

            // Standard Material
            const material = new THREE.PointsMaterial({
                color: color,
                size: 0.15,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true
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
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a); // Dark gray

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, 10, 50);
        this.scene.add(this.camera);

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1.0);
        this.container.appendChild(this.renderer.domElement);

        this.environment = new ArchiveEnvironment(this.scene);
        this.environment.build(Math.max(200, this.models.length * 50));

        this.player = new FirstPersonController(this.camera, document.body);
        this.goomManager = new GoomGame(this.scene, this.camera, this.player);

        // Audio Bindings
        this.player.onJump = () => {
            if (this.goomManager && this.goomManager.active && this.goomManager.audio) {
                this.goomManager.audio.playJump();
            }
        };

        // Unlock Listener to Show Menu
        this.player.controls.addEventListener('unlock', () => {
            if (this.goomManager && this.goomManager.active) return;

            const overlay = document.getElementById('archive-ui-overlay');
            if (overlay) {
                overlay.style.opacity = 1;
                overlay.style.pointerEvents = 'auto'; // Re-enable pointer events for menu
                overlay.innerHTML = `
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:#ff0055; font-family:'Orbitron', sans-serif;">
                        <h1>CONNECTION PAUSED</h1>
                        <button id="btn-archive-resume" style="background:transparent; border:1px solid #00ff88; color:#00ff88; padding:10px 30px; margin:10px; cursor:pointer;">RESUME</button>
                        <button id="btn-archive-exit" style="background:transparent; border:1px solid #ff0055; color:#ff0055; padding:10px 30px; margin:10px; cursor:pointer;">DISCONNECT</button>
                    </div>
                `;

                const btnResume = document.getElementById('btn-archive-resume');
                if (btnResume) {
                    btnResume.addEventListener('click', () => {
                        this.player.lock();
                        overlay.style.opacity = 0;
                        overlay.style.pointerEvents = 'none';
                    });
                }

                const btnExit = document.getElementById('btn-archive-exit');
                if (btnExit) {
                    btnExit.addEventListener('click', () => {
                        this.exitArchive();
                    });
                }
            }
        });

        this.player.controls.addEventListener('lock', () => {
            const overlay = document.getElementById('archive-ui-overlay');
            if (overlay) {
                overlay.style.opacity = 0;
                overlay.style.pointerEvents = 'none';
            }
        });

        this.setupExhibits();

        this.resizeHandler = this.onResize.bind(this);
        window.addEventListener('resize', this.resizeHandler);
    }

    setupExhibits() {
        const loader = new PLYLoader();
        let zPos = 0;

        // Shared Geometry for Performance
        const boxGeometry = new THREE.BoxGeometry(10, 2, 10);

        this.models.forEach((model, i) => {
            zPos -= 50;
            const isLeft = i % 2 === 0;
            const xPos = isLeft ? -30 : 30;

            let colorHex = 0x00f3ff;
            if (model.type === 'LLM') colorHex = 0xff0055;
            if (model.type === 'Multimodal') colorHex = 0xffaa00;
            if (model.type === 'Vision') colorHex = 0xaa00ff;

            const material = new THREE.MeshStandardMaterial({
                color: 0x111111,
                emissive: colorHex,
                emissiveIntensity: 0.2,
                roughness: 0.2,
                metalness: 0.8
            });
            const box = new THREE.Mesh(boxGeometry, material);
            box.position.set(xPos, 1, zPos);
            this.scene.add(box);

            // Light Removed for Performance
            // const light = new THREE.PointLight(colorHex, 1.5, 40);
            // light.position.set(xPos, 8, zPos);
            // this.scene.add(light);

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

            this.exhibits.push({
                model: model,
                position: new THREE.Vector3(xPos, 10, zPos),
                loaded: false,
                color: colorHex
            });
        });
    }

    exitArchive() {
        this.active = false;
        this.container.classList.add('hidden');
        cancelAnimationFrame(this.animationId);

        if (this.player) this.player.unlock();

        if (this.goomManager) {
            this.goomManager.deactivate();
        }

        this.cleanup();

        if (this.onExit) this.onExit();
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

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
    }
}

export const archiveManager = new ArchiveManager();
