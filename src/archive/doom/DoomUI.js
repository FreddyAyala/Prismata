import * as THREE from 'three';
import { GlitchEnemy } from './DoomEnemy.js';

export class DoomUI {
    constructor(game) {
        this.game = game;
        this.hud = null;
        this.crystals = [];
    }

    createHUD() {
        this.hud = document.createElement('div');
        this.hud.id = 'doom-hud';
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
            <div id="doom-hp" style="font-size:40px; color:#00ff00; text-shadow:0 0 10px #00ff00;">HP: 100</div>
            <div id="doom-score" style="font-size:24px; color:#0088ff;">SCORE: 0</div>
            <div id="doom-wave" style="font-size:24px; color:#ffaa00;">WAVE: 1/5</div>
            <div id="doom-enemies" style="font-size:24px; color:#ff0033;">ENEMIES: 0</div>
            <div id="doom-ammo" style="font-size:24px; color:#ffffff;">BLASTER [∞]</div>
        `;
        this.hud.appendChild(stats);
    }

    removeHUD() {
        if (this.hud && this.hud.parentNode) {
            this.hud.parentNode.removeChild(this.hud);
        }
        this.hud = null;
    }

    updateHUD() {
        if (!this.hud) return;
        const hpEl = document.getElementById('doom-hp');
        const scoreEl = document.getElementById('doom-score');
        const waveEl = document.getElementById('doom-wave');
        const ammoEl = document.getElementById('doom-ammo');

        if (hpEl) {
            hpEl.innerText = `HP: ${Math.max(0, Math.ceil(this.game.playerHealth))}`;
            hpEl.style.color = this.game.playerHealth < 30 ? '#ff0000' : (this.game.playerHealth < 60 ? '#ffff00' : '#00ff00');
        }
        if (scoreEl) scoreEl.innerText = `SCORE: ${this.game.score}`;
        if (waveEl) waveEl.innerText = `WAVE: ${this.game.wave}/5`;

        const enemiesEl = document.getElementById('doom-enemies');
        if (enemiesEl) {
            const count = this.game.enemies.length + (this.game.enemiesToSpawn || 0) + (this.game.boss ? 1 : 0);
            enemiesEl.innerText = `THREATS: ${count}`;
        }

        if (ammoEl) {
            const w = this.game.weapons[this.game.currentWeaponIdx];
            const name = w.name; // Uses full name e.g. "BFG 9000"
            const ammo = w.ammo === -1 ? '∞' : w.ammo;
            ammoEl.innerText = `${name} [${ammo}]`;
        }

        this.updateModelHealthBars();
    }

    // --- Instuctions / Start Screen ---
    showInstructions(onStart) {
        if (!this.hud) return;
        const div = document.createElement('div');
        div.style.cssText = `position:absolute; top:0; left:0; width:100%; height:100%; 
                        background:rgba(0,0,0,0.85); display:flex; flex-direction:column; justify-content:center; align-items:center;
                        z-index:5000; pointer-events:auto; color:white; font-family:'Orbitron', sans-serif;`;
        
        div.innerHTML = `
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

                        <!-- IMP -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('imp')}" style="width:50px; height:50px; border:1px solid #ff4400; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#ff4400; font-weight:bold; font-size:14px;">PROMPT ENGINEER</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Spams low-quality tokens. Hallucinates confidence."</div>
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

                        <!-- WRAITH -->
                        <div style="display:flex; align-items:center; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:5px; border-radius:5px;">
                            <img src="${this.generateEnemySnapshot('wraith')}" style="width:50px; height:50px; border:1px solid #00ffff; margin-right:10px; background:#000;">
                            <div>
                                <div style="color:#00ffff; font-weight:bold; font-size:14px;">INFINITY GLITCH</div>
                                <div style="color:#aaa; font-size:11px; font-style:italic;">"Reality distortion field. Hard to debug."</div>
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
                    <button id="doom-start-btn" style="padding: 15px 50px; font-size:24px; background:#ff0033; color:white; border:none; cursor:pointer; 
                                box-shadow: 0 0 20px #ff0033; font-family:'Orbitron', sans-serif; transition: transform 0.2s;">
                        PRESS ENTER TO START
                    </button>
                    <br>
                    <div style="margin-top:10px; font-size:12px; color:#666;">
                        (ESC TO CANCEL)
                    </div>
                </div>
        `;
        this.hud.appendChild(div);

        let started = false;
        const start = () => {
            console.log("DEBUG: DoomUI.start called. started =", started);
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

        const btn = document.getElementById('doom-start-btn');
        if (btn) btn.onclick = () => {
            console.log("DEBUG: Start Button Clicked");
            start();
        };

        const cancelBtn = document.getElementById('doom-cancel-btn');
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
        // avoid spamming
        if (document.getElementById('doom-warning')) return;

        const div = document.createElement('div');
        div.id = 'doom-warning';
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
        const existing = document.getElementById('doom-status');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'doom-status';
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

    triggerGameOver(onRestart) {
        const hud = document.getElementById('doom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();
        
        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top: 0; left: 0; width:100%; height:100%; 
                        background:rgba(50,0,0,0.8); z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;
        div.innerHTML = `
            <h1 style="font-size:80px; color:red; margin-bottom:20px; font-family:'Orbitron', sans-serif;">SYSTEM FAILURE</h1>
            <button id="doom-restart" style="padding: 20px 40px; font-size:30px; background:red; color:white; border:none; cursor:pointer;">REBOOT (ENTER)</button>
        `;
        hud.appendChild(div);

        const restart = () => {
            div.remove();
            if (onRestart) onRestart();
        };

        const btn = document.getElementById('doom-restart');
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

    triggerWin(score, onRestart) {
        const hud = document.getElementById('doom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();

        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top: 0; left: 0; width:100%; height:100%; 
                        background:black; z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;

        // Use user-provided image if they have one. For now using placeholder logic or asset found in logs
        // User asked for "AIBUBBLEBURST.jpg" in a previous context
        // Try to load from assets if possible, else text

        div.innerHTML = `
            <img src="/aibubbleburst.jpg" style="max-width:80%; max-height:50vh; border:2px solid #00ff00; margin-bottom:20px; box-shadow:0 0 50px #00ff00;" onerror="this.style.display='none'">
            <h1 style="font-size:80px; color:#00ff00; margin-bottom:10px; font-family:'Orbitron', sans-serif;">THREAT NEUTRALIZED</h1>
            <div style="font-size:40px; color:white; margin-bottom:30px;">FINAL SCORE: ${score}</div>
            <div style="color:#888; margin-bottom:20px;">PRESS ENTER TO REBOOT SYSTEM or ESC TO EXIT</div>
            <button id="doom-restart-win" style="padding: 20px 40px; font-size:30px; background:#00ff00; color:black; border:none; cursor:pointer;">REBOOT (ENTER)</button>
        `;
        hud.appendChild(div);

        // Hide Boss Bar if visible
        this.updateBossHealth(0, 100);
        const bbar = document.getElementById('doom-boss-bar-v2');
        if (bbar) bbar.remove();
        const ghost = document.getElementById('doom-boss-bar');
        if (ghost) ghost.remove();

        const restart = () => {
            div.remove();
            if (onRestart) onRestart();
        };

        const btn = document.getElementById('doom-restart-win');
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
        const ghosts = ['doom-boss-bar', 'boss-health-bar', 'boss-health-container'];
        ghosts.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        let bar = document.getElementById('doom-boss-bar-v2');
        if (current <= 0 && bar) {
            bar.style.display = 'none';
            return;
        }
        if (current > 0 && !bar) {
            bar = document.createElement('div');
            bar.id = 'doom-boss-bar-v2';
            bar.style.cssText = `position:absolute; top:10%; left:50%; transform:translateX(-50%); width:600px; height:30px; border:2px solid #ff00ff; background:rgba(0,0,0,0.5); z-index:4000;`;
            bar.innerHTML = `
                <div id="doom-boss-fill-v2" style="width:100%; height:100%; background:#ff00ff; transition:width 0.2s;"></div>
                <div style="position:absolute; top:-25px; left:0; width:100%; text-align:center; color:#ff00ff; font-family:'Orbitron', sans-serif; font-weight:bold; font-size:20px;">THE AI BUBBLE</div>
            `;
            this.hud.appendChild(bar);
        }
        if (bar) {
            bar.style.display = 'block';
            const pct = Math.max(0, (current / max) * 100);
            const fill = document.getElementById('doom-boss-fill-v2');
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
            this.crystals.push({ mesh: ex.mesh, bar: bar, inner: inner, maxHp: 100 });
        });
    }

    updateModelHealthBars() {
        if (!this.game || !this.game.camera) return;

        // We know from DoomGame systems that crystal HP is tracked there. 
        // Actually, DoomGame doesn't expose crystal HP nicely yet unless we dig into logic.
        // But wait, the crystals are exhibits.
        // Let's assume full health for visualization if not tracked, OR hook into userData.

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

                // Get HP from userData if available (DoomArena might set it)
                const hp = (c.mesh.userData.health !== undefined) ? c.mesh.userData.health : 100;
                // DoomArena sets default 100
                const pct = Math.max(0, hp);
                c.inner.style.width = `${pct}%`;
                c.inner.style.backgroundColor = pct < 30 ? '#ff0000' : '#00ff00';
            } else {
                c.bar.style.display = 'none';
            }
        });
    }
}
