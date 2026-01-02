import * as THREE from 'three';
import { GlitchEnemy } from './GoomEnemy.js';
// Portrait Removed

export class GoomUI {
    constructor(game) {
        this.game = game;
        this.hud = null;
        this.crystals = [];
    }

    createHUD() {
        this.hud = document.createElement('div');
        this.hud.id = 'goom-hud';
        this.hud.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; user-select: none;
            font-family: 'Orbitron', sans-serif; overflow: hidden; z-index: 4000;
        `;
        document.body.appendChild(this.hud);

        // Crosshair
        const crosshair = document.createElement('div');
        crosshair.innerText = '+';
        crosshair.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 30px; color: #00ff00; opacity: 0.8; text-shadow: 0 0 5px #00ff00;
        `;
        this.hud.appendChild(crosshair);

        // Stats Bar (Bottom Left)
        const stats = document.createElement('div');
        stats.style.cssText = `
            position: absolute; bottom: 20px; left: 20px; text-align: left;
        `;
        stats.innerHTML = `
            <div style="background: linear-gradient(90deg, rgba(0,20,0,0.8), transparent 90%); padding: 15px; border-left: 4px solid #00ff00; width: 320px; backdrop-filter: blur(2px);">
                <!--HP -->
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                    <span style="font-size:16px; color:#00ff00; letter-spacing:1px;">INTEGRITY</span>
                    <span id="goom-hp-text" style="font-size:28px; color:#00ff00; font-weight:bold; text-shadow:0 0 10px #00ff00;">100</span>
                </div>
                <div style="width:100%; height:10px; background:rgba(0,50,0,0.5); margin-bottom:10px; border:1px solid #004400;">
                    <div id="goom-hp-bar" style="width:100%; height:100%; background:#00ff00; box-shadow: 0 0 8px #00ff00;"></div>
                </div>

                <!--ARMOR -->
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                    <span style="font-size:14px; color:#00ff88; letter-spacing:1px;">SHIELD</span>
                    <span id="goom-armor-text" style="font-size:24px; color:#00ff88; font-weight:bold; text-shadow:0 0 10px #00ff88;">0</span>
                </div>
                <div style="width:100%; height:6px; background:rgba(0,50,50,0.5); margin-bottom:15px; border:1px solid #004444;">
                    <div id="goom-armor-bar" style="width:0%; height:100%; background:#00ff88; box-shadow: 0 0 5px #00ff88;"></div>
                </div>

                <!--STAMINA -->
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                     <span style="font-size:10px; color:#88ff88;">ENERGY</span>
                </div>
                <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); margin-bottom:15px;">
                     <div id="goom-stamina" style="width:100%; height:100%; background:#00ff88;"></div>
                </div>

                <!--METRICS GRID-->
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                    <div>
                        <div style="font-size:10px; color:#888;">WAVE</div>
                        <div id="goom-wave" style="font-size:18px; color:#ffaa00;">1/5</div>
                    </div>
                    <div>
                         <div style="font-size:10px; color:#888;">SCORE</div>
                         <div id="goom-score" style="font-size:18px; color:#0088ff;">0</div>
                    </div>
                    <div>
                         <div style="font-size:10px; color:#888;">THREATS</div>
                         <div id="goom-enemies" style="font-size:18px; color:#ff0033;">0</div>
                    </div>
                </div>

                <!--WEAPON -->
            <div>
                <div id="goom-ammo" style="font-size:18px; color:#ffffff; letter-spacing:1px; text-shadow:0 0 5px white; margin-bottom:5px;">BLASTER [∞]</div>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-size:10px; color:#ffff00; background:rgba(255,255,0,0.1); padding:2px 5px; border-radius:2px;">[R-CLICK] ALT-FIRE</div>
                    <span id="goom-reload-msg" style="font-size:12px; color:#ff0000; opacity:0; font-weight:bold; letter-spacing:1px;">RECHARGING</span>
                </div>
            </div>
            </div >
        `;
        this.hud.appendChild(stats);

        // Portrait Removed

        // RADAR Container (Top Right)
        const radar = document.createElement('div');
        radar.id = 'goom-radar';
        radar.style.cssText = `
            position: absolute; top: 20px; right: 20px; width: 150px; height: 150px;
            border: 2px solid #00ff00; border-radius: 50%; background: rgba(0, 20, 0, 0.5);
            overflow: hidden; opacity: 0.8;
        `;
        // Player Center Dot
        radar.innerHTML = `<div style="position:absolute; top:50%; left:50%; width:4px; height:4px; background:#00ff00; transform:translate(-50%,-50%); border-radius:50%;"></div>`;
        this.hud.appendChild(radar);
    }

    removeHUD() {
        if (this.hud && this.hud.parentNode) {
            this.hud.parentNode.removeChild(this.hud);
        }
        this.hud = null;
        this.hidePauseMenu(); // Ensure pause menu is gone too
    }

    // Portrait Removed
    resetHUD() {
        // No-op
    }

    updateReloadStatus(isReloading) {
        const el = document.getElementById('goom-reload-msg');
        if (el) {
            el.style.opacity = isReloading ? 1 : 0;
            if (isReloading) {
                el.innerText = "BEAM RECHARGING...";
                el.style.color = "#ff0000";
            }
        }
    }

    updateHUD() {
        if (!this.hud) return;

        const hpText = document.getElementById('goom-hp-text');
        const hpBar = document.getElementById('goom-hp-bar');
        const armorText = document.getElementById('goom-armor-text');
        const armorBar = document.getElementById('goom-armor-bar');


        const scoreEl = document.getElementById('goom-score');
        const waveEl = document.getElementById('goom-wave');
        const enemiesEl = document.getElementById('goom-enemies');
        const ammoEl = document.getElementById('goom-ammo');
        const staminaEl = document.getElementById('goom-stamina');

        const hp = Math.max(0, Math.ceil(this.game.playerHealth));
        const armor = Math.max(0, Math.ceil(this.game.playerArmor));

        if (hpText) {
            hpText.innerText = `HP: ${hp}`;
            hpText.style.color = hp < 30 ? '#ff0000' : (hp < 60 ? '#ffff00' : '#00ff00');
            if (hpBar) {
                hpBar.style.width = `${Math.min(100, hp)}%`;
                hpBar.style.backgroundColor = hpText.style.color;
            }
        }
        if (armorText) {
            armorText.innerText = `ARMOR: ${armor}`;
            const armorPct = Math.min(100, (armor / 200) * 100); // Max 200
            if (armorBar) armorBar.style.width = `${armorPct}%`;
        }

        // Update 3D Portrait
        // Update 3D Portrait REMOVED

        if (scoreEl) scoreEl.innerText = `SCORE: ${this.game.score}`;
        if (waveEl) waveEl.innerText = `WAVE: ${this.game.wave}/5`;
        if (enemiesEl) enemiesEl.innerHTML = `${this.game.enemies.length + (this.game.boss ? 1 : 0)}`;
        if (ammoEl) {
            const w = this.game.weapons[this.game.currentWeaponIdx];
            if (w) {
                ammoEl.innerText = `${w.name} [${w.ammo === -1 ? '∞' : w.ammo}]`;
                ammoEl.style.color = w.color ? '#' + w.color.toString(16).padStart(6, '0') : '#ffffff';
            }
        }

        if (staminaEl && this.game.player) {
            const pct = (this.game.player.stamina / this.game.player.maxStamina) * 100;
            staminaEl.style.width = `${pct}%`;
            staminaEl.style.backgroundColor = pct < 20 ? '#ff0000' : (pct < 50 ? '#ffff00' : '#00ff88');
        }

        this.updateModelHealthBars();
        this.updateRadar(); // NEW
    }

    updateRadar() {
        let canvas = document.getElementById('goom-radar-canvas');
        if (!canvas) {
            const container = document.getElementById('goom-radar');
            if (container) {
                // Clear DOM dots once
                container.innerHTML = '';
                canvas = document.createElement('canvas');
                canvas.id = 'goom-radar-canvas';
                canvas.width = 150;
                canvas.height = 150;
                canvas.style.cssText = "width:100%; height:100%; border-radius:50%;";
                container.appendChild(canvas);
            } else {
                return;
            }
        }

        if (!this.game || !this.game.camera) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center (Player)
        const cx = 75;
        const cy = 75;
        const radius = 75;
        const range = 150.0; // Range

        // Draw Player
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        const forward = new THREE.Vector3();
        this.game.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        const camPos = this.game.camera.position;

        // Draw Enemies
        this.game.enemies.forEach(e => {
            if (!e.mesh || !e.mesh.visible || e.life <= 0) return;
            const toEnemy = new THREE.Vector3().subVectors(e.mesh.position, camPos);
            toEnemy.y = 0;
            const dist = toEnemy.length();

            if (dist < range) {
                const f = toEnemy.dot(forward);
                const r = toEnemy.dot(right);

                // x = r, y = -f
                const px = cx + (r / range) * radius;
                const py = cy - (f / range) * radius;

                // Clamp to Circle
                const dx = px - cx;
                const dy = py - cy;
                if (dx * dx + dy * dy < radius * radius) {
                    ctx.fillStyle = 'red';
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });

        // Draw Crystals
        this.game.ui.crystals.forEach(c => {
            if (!c.mesh || !c.mesh.visible || c.mesh.userData.health <= 0) return;
            const toC = new THREE.Vector3().subVectors(c.mesh.position, camPos);
            toC.y = 0;
            const dist = toC.length();
            if (dist < range) {
                const f = toC.dot(forward);
                const r = toC.dot(right);

                const px = cx + (r / range) * radius;
                const py = cy - (f / range) * radius;

                const dx = px - cx;
                const dy = py - cy;

                if (dx * dx + dy * dy < radius * radius) {
                    ctx.fillStyle = c.mesh.userData.isCorrupted ? '#ff00ff' : '#00ffff';
                    ctx.beginPath();
                    ctx.arc(px, py, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    }

    // --- Instuctions / Start Screen ---
    showInstructions(onStart) {
        if (!this.hud) return;
        const div = document.createElement('div');
        div.style.cssText = `position:absolute; top:0; left:0; width:100%; height:100%; 
                        background:rgba(0,0,0,0.85); display:flex; flex-direction:column; justify-content:center; align-items:center;
                        z-index:5000; pointer-events:auto; color:white; font-family:'Orbitron', sans-serif;`;

        const isMobile = window.innerWidth <= 900;

        if (isMobile) {
            // Simplified Mobile Layout
            div.innerHTML = `
                <img src="/unnamed_8.jpg" style="max-height:100px; border:2px solid #ff0033; margin-bottom:20px; box-shadow:0 0 20px red;">
                <h1 style="font-size:30px; color:#ff0033; margin-bottom:10px; text-shadow:0 0 20px red; text-align:center;">OPERATION FIREWALL</h1>
                <div style="font-size:14px; color:#aaa; margin-bottom:20px; text-align:center;">CRITICAL SYSTEM BREACH</div>

                <div style="background:rgba(0,0,0,0.5); padding:15px; border:1px solid #444; border-radius:10px; width:90%; text-align:center; margin-bottom:20px;">
                    <h3 style="color:#00ff88; margin-top:0;">DEFENSE PROTOCOLS</h3>
                    <div style="font-size:14px; line-height:1.6;">
                         <b style="color:#ffaa00;">USE ON-SCREEN CONTROLS</b><br>
                         LEFT STICK: MOVE<br>
                         RIGHT SIDE: AIM<br>
                         BUTTONS: FIRE / JUMP / WEAPON
                    </div>
                </div>

                <button id="goom-start-btn" style="padding: 15px 40px; font-size:20px; background:#ff0033; color:white; border:none; cursor:pointer; 
                            box-shadow: 0 0 20px #ff0033; font-family:'Orbitron', sans-serif;">
                    TAP TO ENGAGE
                </button>
                <div style="margin-top:15px; font-size:12px; color:#666;">(TAP ELSEWHERE TO CANCEL)</div>
            `;

            // Allow tap on background to cancel? No, might be annoying.
            // Let's rely on the button.
        } else {
        // Desktop Layout (Original)
            div.innerHTML = `
                <img src="/unnamed_8.jpg" style="max-height:150px; border:2px solid #ff0033; margin-bottom:20px; box-shadow:0 0 20px red;">
                <h1 style="font-size:50px; color:#ff0033; margin-bottom:10px; text-shadow:0 0 20px red; text-align:center;">OPERATION FIREWALL</h1>
                <div style="font-size:20px; color:#aaa; margin-bottom:30px; text-align:center;">CRITICAL SYSTEM BREACH DETECTED</div>

                <div style="display:flex; justify-content:space-between; align-items:flex-start; width:90%; max-width:1000px; margin:0 auto; margin-bottom:30px;">
                    <!-- LEFT COLUMN: CONTROLS -->
                    <div style="width:45%; background:rgba(0,0,0,0.5); padding:20px; border:1px solid #444; border-radius:10px;">
                        <h3 style="color:#00ff88; border-bottom:1px solid #00ff88; padding-bottom:5px; margin-top:0;">DEFENSE PROTOCOLS</h3>
                        <div style="text-align:left; line-height:1.8; font-size:16px;">
                            <div><b style="color:#00ff88;">WASD</b>: NAVIGATE LAYERS</div>
                            <div><b style="color:#00ff88;">SHIFT</b>: OVERCLOCK (SPRINT)</div>
                            <div><b style="color:#00ff88;">SPACE</b>: VERTICAL BUFFER (JUMP)</div>
                            <div><b style="color:#00ff88;">MOUSE</b>: AIM DECODER</div>
                            <div><b style="color:#00ff88;">CLICK</b>: PURGE GLITCH (FIRE)</div>
                            <div><b style="color:#00ff88;">1-5</b>: SWAP MODULES</div>
                            <div style="margin-top:10px; color:#ff0033; font-weight:bold;">GOAL: PROTECT THE CRYSTALS</div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: THREAT DATABASE -->
                    <div style="width:50%; text-align:left;">
                        <h3 style="color:#ff0033; border-bottom:1px solid #ff0033; padding-bottom:5px; margin-top:0;">THREAT DATABASE</h3>

                        <!-- VIBE CODER (Normal) -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('normal')}" style="width:50px; height:50px; border:1px solid #ff0000; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#ff0000; font-weight:bold; font-size:14px;">VIBE CODER</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Just vibing. Basic threat."</div>
                            </div>
                        </div>

                         <!-- IMP -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('imp')}" style="width:50px; height:50px; border:1px solid #ff4400; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#ff4400; font-weight:bold; font-size:14px;">PROMPT ENGINEER</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Spams low-quality tokens. Hallucinates confidence."</div>
                            </div>
                        </div>

                        <!-- GROWTH HACKER (Scout) -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('scout')}" style="width:50px; height:50px; border:1px solid #00ff00; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#00ff00; font-weight:bold; font-size:14px;">GROWTH HACKER</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Disrupts stability. Flanks rapidly."</div>
                            </div>
                        </div>

                        <!-- TANK -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('tank')}" style="width:50px; height:50px; border:1px solid #3366ff; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#3366ff; font-weight:bold; font-size:14px;">VC FUNDING WHALE</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Bloated with cash. Hard to kill. Zero revenue."</div>
                            </div>
                        </div>

                        <!-- 10X DEVELOPER (Berzerker) -->
                         <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('berzerker')}" style="width:50px; height:50px; border:1px solid #ff00ff; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#ff00ff; font-weight:bold; font-size:14px;">10X DEVELOPER</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Moves fast. Breaks things. Refuses code review."</div>
                            </div>
                        </div>

                        <!-- WRAITH -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('wraith')}" style="width:50px; height:50px; border:1px solid #00ffff; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#00ffff; font-weight:bold; font-size:14px;">VAPORWARE</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Reality distortion. Hard to debug."</div>
                            </div>
                        </div>

                         <!-- BOSS -->
                        <div style="display:flex; align-items:center; margin-bottom:5px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <div style="width:50px; height:50px; border:1px solid #ff00ff; margin-right:10px; background:#000; display:flex; align-items:center; justify-content:center; color:#ff00ff; font-size:24px;">?</div>
                            <div>
                                <div style="color:#ff00ff; font-weight:bold; font-size:14px;">TOP SECRET</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Classified. Do not approach."</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align:center;">
                    <button id="goom-start-btn" style="padding: 15px 50px; font-size:24px; background:#ff0033; color:white; border:none; cursor:pointer; 
                                box-shadow: 0 0 20px #ff0033; font-family:'Orbitron', sans-serif; transition: transform 0.2s;">
                        PRESS ENTER TO START
                    </button>
                    <br>
                    <div style="margin-top:10px; font-size:12px; color:#666;">
                        (ESC TO CANCEL)
                    </div>
                </div>
            `;
        }

        this.hud.appendChild(div);

        let started = false;
        const start = () => {
            console.log("DEBUG: GoomUI.start called. started =", started);
            if (started) return;
            started = true;
            div.remove();
            window.removeEventListener('keydown', keyH);
            if (onStart) onStart();
        };

        const keyH = (e) => {
            if (e.key === 'Enter') {
                console.log("DEBUG: Enter key pressed in Instructions");
                start();
            }
        };
        window.addEventListener('keydown', keyH);

        const btn = document.getElementById('goom-start-btn');
        if (btn) btn.onclick = () => {
            console.log("DEBUG: Start Button Clicked");
            start();
        };

        const cancelBtn = document.getElementById('goom-cancel-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                div.remove();
                window.removeEventListener('keydown', keyH);
                if (this.game) this.game.deactivate();
            };
            cancelBtn.onmouseover = () => { cancelBtn.style.color = '#fff'; cancelBtn.style.borderColor = '#fff'; };
            cancelBtn.onmouseout = () => { cancelBtn.style.color = '#888'; cancelBtn.style.borderColor = '#666'; };
        }
    }

    generateEnemySnapshot(type) {
        const width = 128;
        const height = 128;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

        // Dynamic Camera Positioning based on enemy scale
        let dist = 8;
        let yOffset = 0;
        if (type === 'tank') { dist = 14; yOffset = 1; }
        else if (type === 'wraith') { dist = 10; yOffset = 0.5; }
        else if (type === 'imp') { dist = 8; yOffset = 0.5; }
        else if (type === 'scout') { dist = 9; yOffset = 0.5; }
        else if (type === 'berzerker') { dist = 10; yOffset = 0.5; }
        else if (type === 'normal') { dist = 8; yOffset = 0.5; }

        camera.position.set(0, 1 + yOffset, dist);
        camera.lookAt(0, yOffset, 0);

        // Bright Lights
        const amb = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(amb);
        const dir = new THREE.DirectionalLight(0xffffff, 1.2);
        dir.position.set(2, 5, 5);
        scene.add(dir);

        // Enemy Mesh
        const enemy = new GlitchEnemy(scene, new THREE.Vector3(0, 0, 0), null, type, 'hunter');
        enemy.mesh.rotation.y = Math.PI / 6;

        // Force Solid Visibility
        const makeSolid = (obj) => {
            if (obj.isMesh) {
                // Clone needed props
                const oldColor = obj.material.color.getHex();
                obj.material = new THREE.MeshStandardMaterial({
                    color: oldColor,
                    wireframe: true, // Restore Wireframe for Threat Database
                    transparent: false,
                    opacity: 1.0,
                    roughness: 0.4,
                    metalness: 0.6
                });
            }
            if (obj.children) obj.children.forEach(makeSolid);
        };
        makeSolid(enemy.mesh);

        // Render
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: false, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);

        renderer.render(scene, camera);
        const dataURL = canvas.toDataURL();

        renderer.dispose();
        return dataURL;
    }

    showWaveTitle(text) {
        if (!this.hud) return;
        const div = document.createElement('div');
        div.innerText = text;
        div.style.cssText = `position:absolute; top:30%; left:50%; transform:translate(-50%, -50%); 
                    font-size:80px; color:#ff0033; font-weight:bold; text-shadow:0 0 20px red; opacity:0; transition:opacity 0.5s;`;
        this.hud.appendChild(div);
        setTimeout(() => div.style.opacity = 1, 100);
        setTimeout(() => { div.style.opacity = 0; setTimeout(() => div.remove(), 500); }, 3000);
    }

    showWarning(text) {
        if (!this.hud) return;
        // Allow overwriting warnings
        const existing = document.getElementById('goom-warning');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'goom-warning';
        div.innerText = text;
        div.style.cssText = `position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); 
                    font-size:50px; color:#ff0033; font-weight:bold; text-shadow:0 0 20px red; 
                    animation: blink 0.5s infinite alternate; pointer-events:none;`;

        // Add Blink Keyframes if valid
        const style = document.createElement('style');
        style.innerHTML = `@keyframes blink { from { opacity: 1; } to { opacity: 0.2; } }`;
        div.appendChild(style);

        this.hud.appendChild(div);
        setTimeout(() => { if (div.parentElement) div.remove(); }, 3000);
    }

    showStatus(text) {
        if (!this.hud) return;
        // Avoid duplicates if same message
        const existing = document.getElementById('goom-status');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'goom-status';
        div.innerText = text;
        div.style.cssText = `position:absolute; bottom:15%; left:50%; transform:translate(-50%, -50%); 
                    font-size:30px; color:#00ffff; font-weight:bold; text-shadow:0 0 10px #00ffff; 
                    opacity:0; transition:opacity 0.2s; pointer-events:none;`;

        this.hud.appendChild(div);

        // Fade In
        requestAnimationFrame(() => div.style.opacity = 1);

        // Remove after 2s
        setTimeout(() => {
            if (div.style) div.style.opacity = 0;
            setTimeout(() => { if (div.parentElement) div.remove(); }, 500);
        }, 2000);
    }

    flashDamage() {
        if (!this.hud) return;

        let flash = document.getElementById('goom-damage-flash');
        if (!flash) {
            flash = document.createElement('div');
            flash.id = 'goom-damage-flash';
            flash.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: red; opacity: 0; pointer-events: none; z-index: 100;
                transition: opacity 0.1s ease-out;
            `;
            this.hud.appendChild(flash);
        }

        // Trigger Flash
        flash.style.opacity = 0.4;
        setTimeout(() => {
            flash.style.opacity = 0;
        }, 100);
    }

    triggerGameOver(onRestart) {
        const hud = document.getElementById('goom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();

        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top: 0; left: 0; width:100%; height:100%; 
                        background:rgba(50,0,0,0.8); z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;
        div.innerHTML = `
            <h1 style="font-size:80px; color:red; margin-bottom:20px; font-family:'Orbitron', sans-serif;">SYSTEM FAILURE</h1>
            <button id="goom-restart" style="padding: 20px 40px; font-size:30px; background:red; color:white; border:none; cursor:pointer;">REBOOT (ENTER)</button>
        `;
        hud.appendChild(div);

        const restart = () => {
            div.remove();
            if (onRestart) onRestart();
        };

        const btn = document.getElementById('goom-restart');
        if (btn) btn.onclick = restart;

        // ENTER key support
        const keyH = (e) => {
            if (e.key === 'Enter') {
                window.removeEventListener('keydown', keyH);
                restart();
            }
        };
        window.addEventListener('keydown', keyH);
    }

    triggerWin(score, onRestart, stats) {
        const hud = document.getElementById('goom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();

        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top: 0; left: 0; width:100%; height:100%; 
                        background:black; z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;

        // Stats Table Generation
        let statsHtml = '';
        if (stats) {
            const map = {
                'imp': { name: 'PROMPT ENGINEER', color: '#ff4400' },
                'tank': { name: 'VC WHALE', color: '#3366ff' },
                'scout': { name: 'GROWTH HACKER', color: '#00ff00' },
                'wraith': { name: 'VAPORWARE', color: '#00ffff' },
                'berzerker': { name: '10X DEVELOPER', color: '#ff00ff' },
                'normal': { name: 'VIBE CODER', color: '#ff0000' },
                'THE AI BUBBLE': { name: 'THE AI BUBBLE', color: '#ff00ff' } // Matched Key
            };

            statsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px; width:60%; max-width:500px; text-align:left;">`;
            for (const [key, val] of Object.entries(stats)) {
                if (val > 0 && map[key]) {
                    statsHtml += `<div style="color:${map[key].color}; border-bottom:1px solid #333;">${map[key].name}</div>
                                  <div style="color:white; text-align:right; border-bottom:1px solid #333;">${val}</div>`;
                }
            }
            statsHtml += `</div>`;
        }

        div.innerHTML = `
            <h1 style="font-size:70px; color:#00ff00; margin-bottom:10px; font-family:'Orbitron', sans-serif;">THREAT NEUTRALIZED</h1>
            <h2 style="font-size:30px; color:#ff00ff; margin-bottom:30px; font-family:'Orbitron', sans-serif; text-shadow:0 0 10px #ff00ff;">(We popped the AI bubble!!)</h2>
            <h2 style="color:white; margin-bottom:40px; font-family:'Orbitron', sans-serif;">FINAL SCORE: ${score}</h2>
            <div style="margin-bottom:40px; text-align:left; font-family:'Orbitron', sans-serif; font-size:18px;">
                ${statsHtml}
            </div>
            <div style="font-size:14px; color:#aaa; margin-bottom:10px;">PRESS ENTER TO REBOOT SYSTEM</div>
            <button id="goom-restart-win" style="padding: 20px 40px; font-size:30px; background:#00ff00; color:black; border:none; cursor:pointer; font-weight:bold;">REBOOT (ENTER)</button>
        `;
        hud.appendChild(div);

        // Hide Boss Bar if visible
        this.updateBossHealth(0, 100);
        const bbar = document.getElementById('goom-boss-bar-v2');
        if (bbar) bbar.remove();
        const ghost = document.getElementById('goom-boss-bar');
        if (ghost) ghost.remove();

        const restart = () => {
            div.remove();
            if (onRestart) onRestart();
        };

        const btn = document.getElementById('goom-restart-win');
        if (btn) btn.onclick = restart;

        const keyH = (e) => {
            if (e.key === 'Enter') {
                window.removeEventListener('keydown', keyH);
                restart();
            }
        };
        window.addEventListener('keydown', keyH);
    }

    updateBossHealth(current, max) {
        // cleanup legacy ghost bars
        const ghosts = ['goom-boss-bar', 'boss-health-bar', 'boss-health-container'];
        ghosts.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        let bar = document.getElementById('goom-boss-bar-v2');
        if (current <= 0 && bar) {
            bar.style.display = 'none';
            return;
        }
        if (current > 0 && !bar) {
            bar = document.createElement('div');
            bar.id = 'goom-boss-bar-v2';
            bar.style.cssText = `position:absolute; top:10%; left:50%; transform:translateX(-50%); width:600px; height:30px; border:2px solid #ff00ff; background:rgba(0,0,0,0.5); z-index:4000;`;
            bar.innerHTML = `
                <div id="goom-boss-fill-v2" style="width:100%; height:100%; background:#ff00ff; transition:width 0.2s;"></div>
                <div style="position:absolute; top:-25px; left:0; width:100%; text-align:center; color:#ff00ff; font-family:'Orbitron', sans-serif; font-weight:bold; font-size:20px;">THE AI BUBBLE</div>
            `;
            this.hud.appendChild(bar);
        }
        if (bar) {
            bar.style.display = 'block';
            const pct = Math.max(0, (current / max) * 100);
            const fill = document.getElementById('goom-boss-fill-v2');
            if (fill) fill.style.width = `${pct}%`;
        }
    }

    initModelHealthBars(exhibits) {
        this.crystals = [];
        exhibits.forEach(ex => {
            if (!ex.mesh) return;
            const bar = document.createElement('div');
            bar.style.cssText = `position:absolute; width:60px; height:6px; background:rgba(0,0,0,0.5); border:1px solid #00ff00; pointer-events:none; display:none; transform:translate(-50%, -50%);`;
            const inner = document.createElement('div');
            inner.style.cssText = `width:100%; height:100%; background:#00ff00; transition:width 0.2s;`;
            bar.appendChild(inner);
            this.hud.appendChild(bar);

            // FIX: Ensure Health is linked to Mesh UserData
            if (ex.mesh.userData.health === undefined) ex.mesh.userData.health = 250;
            if (ex.mesh.userData.maxHealth === undefined) ex.mesh.userData.maxHealth = 250;
            if (ex.mesh.userData.name === undefined) ex.mesh.userData.name = "DATA NODE";

            this.crystals.push({ mesh: ex.mesh, bar: bar, inner: inner, maxHp: 250 });
        });
    }

    updateModelHealthBars() {
        if (!this.game || !this.game.camera) return;

        this.crystals.forEach(c => {
            if (!c.mesh.visible || (c.mesh.userData.health !== undefined && c.mesh.userData.health <= 0)) {
                c.bar.style.display = 'none';
                return;
            }
            // Project position
            const pos = c.mesh.position.clone();
            pos.y += 2.0; // Above crystal
            pos.project(this.game.camera);

            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

            if (pos.z < 1.0) {
                c.bar.style.display = 'block';
                c.bar.style.left = `${x}px`;
                c.bar.style.top = `${y}px`;

                // Get HP from userData if available (GoomArena might set it)
                const hp = (c.mesh.userData.health !== undefined) ? c.mesh.userData.health : 100;
                // GoomArena sets default 100
                const pct = Math.max(0, hp);
                c.inner.style.width = `${pct}%`;
                c.inner.style.backgroundColor = pct < 30 ? '#ff0000' : '#00ff00';
            } else {
                c.bar.style.display = 'none';
            }
        });
    }

    updateStamina() {
        if (!this.hud) return;
        const staminaEl = document.getElementById('goom-stamina');
        if (staminaEl && this.game.player) {
            const pct = (this.game.player.stamina / this.game.player.maxStamina) * 100;
            staminaEl.style.width = `${pct}%`;
            staminaEl.style.backgroundColor = pct < 20 ? '#ff0000' : (pct < 50 ? '#ffff00' : '#00ff88');
        }
    }
    // PAUSE MENU
    showPauseMenu(onResume, onExit) {
        if (this.pauseMenu) return; // Already visible

        this.pauseMenu = document.createElement('div');
        this.pauseMenu.id = 'goom-pause-menu';
        this.pauseMenu.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            z-index: 5000; pointer-events: auto;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: rgba(0, 20, 0, 0.9); border: 2px solid #00ff00;
            padding: 40px; text-align: center; box-shadow: 0 0 20px #00ff00;
            min-width: 300px; transform: skew(-5deg);
        `;

        const title = document.createElement('h1');
        title.innerText = "PAUSED";
        title.style.cssText = `
            font-size: 48px; color: #00ff00; margin: 0 0 30px 0;
            text-shadow: 0 0 10px #00ff00; letter-spacing: 5px;
        `;
        container.appendChild(title);

        const btnStyle = `
            display: block; width: 100%; margin: 10px 0; padding: 15px;
            background: transparent; border: 1px solid #00ff00; color: #00ff00;
            font-family: 'Orbitron', sans-serif; font-size: 20px; cursor: pointer;
            transition: all 0.2s; text-transform: uppercase; letter-spacing: 2px;
        `;

        const createBtn = (text, onClick) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.cssText = btnStyle;
            btn.onmouseover = () => {
                btn.style.background = '#00ff00';
                btn.style.color = '#000000';
                btn.style.boxShadow = '0 0 15px #00ff00';
            };
            btn.onmouseout = () => {
                btn.style.background = 'transparent';
                btn.style.color = '#00ff00';
                btn.style.boxShadow = 'none';
            };
            btn.onclick = onClick;
            return btn;
        };

        const resumeBtn = createBtn("RESUME MISSION", () => {
            if (onResume) onResume();
        });

        const exitBtn = createBtn("ABORT MISSION", () => {
            if (onExit) onExit();
        });

        container.appendChild(resumeBtn);
        container.appendChild(exitBtn);
        this.pauseMenu.appendChild(container);

        // Append to body (to be on top of everything) or hud?
        // Body is safer for full screen overlays
        document.body.appendChild(this.pauseMenu);
    }

    hidePauseMenu() {
        if (this.pauseMenu) {
            if (this.pauseMenu.parentNode) this.pauseMenu.parentNode.removeChild(this.pauseMenu);
            this.pauseMenu = null;
        }
    }
}
