import * as THREE from 'three';

export class DoomUI {
    constructor(game) {
        this.game = game;
        this.hud = null;
        this.crystals = [];
    }

    createHUD() {
        if (document.getElementById('doom-hud')) return;
        this.hud = document.createElement('div');
        this.hud.id = 'doom-hud';
        this.hud.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; color:#ff0033; font-family:'Orbitron', sans-serif; font-size:24px; text-shadow:0 0 10px #ff0000; z-index:4000;";
        this.hud.innerHTML = `
            <div style="position:absolute; bottom:20px; left:20px; pointer-events:none;">
                <div style="font-size:32px; color:#00ff88; margin-bottom:10px;">HP: <span id="doom-hp">100</span></div>
                <div style="width: 300px; height: 10px; background: rgba(0,255,136,0.1); border: 1px solid #00ff88; margin-bottom: 5px; position: relative; overflow: hidden;">
                    <div id="doom-stamina-bar" style="width: 100%; height: 100%; background: #00f3ff; transition: width 0.1s; box-shadow: 0 0 10px #00f3ff;"></div>
                </div>
                <div style="font-size:18px; color:#ffaa00; margin-bottom:5px;">SCORE: <span id="doom-score">0</span></div>
                <div style="font-size:18px; color:#ff00ff;">WAVE: <span id="doom-wave">1/5</span></div>
                <div id="doom-weapon" style="font-size:22px; color:#eee; margin-top:10px;">BLASTER [∞]</div>
            </div>
            
            <div id="doom-crosshair" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; pointer-events: none;">
                <div style="width: 20px; height: 2px; background: #00ff88; position: absolute; left: -10px; top: 0; box-shadow: 0 0 5px #00ff88;"></div>
                <div style="width: 2px; height: 20px; background: #00ff88; position: absolute; left: 0; top: -10px; box-shadow: 0 0 5px #00ff88;"></div>
                <div style="width: 4px; height: 4px; background: #00ff88; border-radius: 50%; position: absolute; left: -1px; top: -1px; box-shadow: 0 0 5px #00ff88;"></div>
            </div>
        `;
        document.body.appendChild(this.hud);
    }

    updateHUD() {
        if (!this.hud) return;
        const w = this.game.weapons[this.game.currentWeaponIdx];
        const hp = Math.ceil(this.game.playerHealth);

        const elHP = document.getElementById('doom-hp');
        if (elHP) { elHP.innerText = hp; elHP.style.color = hp < 30 ? '#ff0000' : '#00ff88'; }

        const elScore = document.getElementById('doom-score');
        if (elScore) elScore.innerText = this.game.score;
        
        const elWave = document.getElementById('doom-wave');
        if (elWave) elWave.innerText = this.game.wave + "/5";

        // Stamina HUD Update
        if (this.game.player) {
            const elStamina = document.getElementById('doom-stamina-bar');
            if (elStamina) {
                const pct = (this.game.player.stamina / this.game.player.maxStamina) * 100;
                elStamina.style.width = pct + '%';
                if (pct < 30) elStamina.style.background = '#ff0033';
                else elStamina.style.background = '#00f3ff';
            }
        }

        const elWep = document.getElementById('doom-weapon');
        if (elWep) {
            elWep.innerText = `${w.name} [${w.ammo === -1 ? '∞' : w.ammo}]`;
            elWep.style.color = '#' + new THREE.Color(w.color).getHexString();
        }
    }

    showInstructions(onStart) {
        const existing = document.getElementById('doom-instructions');
        if (existing) existing.remove();

        if (document.pointerLockElement) document.exitPointerLock();

        if (!this.hud) return;

        const div = document.createElement('div');
        div.id = 'doom-instructions';
        div.style.cssText = `position: absolute; top:0; left:0; width:100%; height:100%; 
                        background: rgba(0,0,0,0.95); display:flex; flex-direction:column; justify-content:center; align-items:center;
                        z-index:5000; pointer-events:auto; color:white; font-family:'Orbitron', sans-serif;`;
        
        div.innerHTML = `
                <h1 style="font-size:60px; color:#ff0033; margin-bottom:10px; text-shadow:0 0 20px red;">OPERATION FIREWALL</h1>
                <div style="font-size:24px; color:#aaa; margin-bottom:40px;">CRITICAL SYSTEM BREACH DETECTED</div>
                
                <div style="background:rgba(255,255,255,0.05); padding:30px; border:1px solid #444; border-radius:10px; margin-bottom:40px; text-align:left; line-height:1.6;">
                    <p><b style="color:#00ff88;">WASD</b>: NAVIGATE PHYSICAL LAYERS</p>
                    <p><b style="color:#00ff88;">SHIFT</b>: OVERCLOCK MOVEMENT (SPRINT)</p>
                    <p><b style="color:#00ff88;">SPACE</b>: VERTICAL BUFFER ESCAPE (JUMP)</p>
                    <p><b style="color:#00ff88;">MOUSE</b>: AIM DECODER</p>
                    <p><b style="color:#00ff88;">CLICK</b>: PURGE GLITCH (FIRE)</p>
                    <p><b style="color:#00ff88;">1-5</b>: SELECT WEAPON MODULES</p>
                    <p><b style="color:#ff0033;">GOAL</b>: PROTECT THE CRYSTAL DEFENSE MODELS AT ALL COSTS.</p>
                </div>

                <button id="doom-start-btn" style="padding: 20px 60px; font-size:28px; background:#ff0033; color:white; border:none; cursor:pointer; 
                            box-shadow: 0 0 20px #ff0033; font-family:'Orbitron', sans-serif; transition: transform 0.2s;">
                    PRESS ENTER TO INITIATE SEQUENCE
                </button>
                <div style="margin-top:20px;">
                    <button id="doom-cancel-btn" style="background:transparent; border:1px solid #666; color:#888; padding:10px 20px; font-family:'Orbitron', sans-serif; cursor:pointer;">
                        I'M SCARED, CANCEL (ESC)
                    </button>
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

    triggerGameOver(onRestart) {
        const hud = document.getElementById('doom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();
        
        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top: 0; left: 0; width:100%; height:100%; 
                        background:rgba(50,0,0,0.8); z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;
        div.innerHTML = `
                <h1 style="font-size: 80px; color: red; text-shadow: 0 0 20px red; font-family:'Orbitron', sans-serif;">GAME OVER</h1>
                <button id="doom-restart-btn" style="padding: 15px 40px; font-size: 30px; margin-top: 30px;
                            border: 2px solid red; background: #220000; color: white; cursor: pointer; font-family:'Orbitron', sans-serif;">
                    RESTART SYSTEM
                </button>
                <div style="margin-top:10px; color:#aaa;">(OR PRESS 'R')</div>
        `;
        hud.appendChild(div);
        
        setTimeout(() => {
            const btn = document.getElementById('doom-restart-btn');
            if (btn) btn.onclick = onRestart;
        }, 100);
    }

    triggerWin(onRestart) {
        const hud = document.getElementById('doom-hud');
        if (!hud) return;
        if (document.pointerLockElement) document.exitPointerLock();

        const div = document.createElement('div');
        div.style.cssText = `position: absolute; top:0; left:0; width:100%; height:100%; 
                        background:rgba(0,50,0,0.8); z-index:5000; pointer-events:auto;
                        display:flex; flex-direction:column; justify-content:center; align-items:center;`;
        div.innerHTML = `
                <h1 style="font-size: 80px; color: #00ff88; text-shadow: 0 0 20px #00ff88; font-family:'Orbitron', sans-serif;">SYSTEM SECURED</h1>
                <div style="font-size:32px; color:white; margin-bottom:20px;">FIREWALL INTEGRITY: 100%</div>
                <button id="doom-win-btn" style="padding: 15px 40px; font-size: 30px; margin-top: 30px;
                            border: 2px solid #00ff88; background: #002200; color: white; cursor: pointer; font-family:'Orbitron', sans-serif;">
                    RETURN TO ARCHIVE
                </button>
        `;
        hud.appendChild(div);

        setTimeout(() => {
            const btn = document.getElementById('doom-win-btn');
            if (btn) btn.onclick = onRestart;
        }, 100);
    }

    initModelHealthBars(exhibitsSource) {
        this.crystals = [];
        if (exhibitsSource && exhibitsSource.length > 0) {
            exhibitsSource.forEach(ex => {
                if (ex.mesh && ex.loaded) {
                    const obj = ex.mesh;
                    if (obj.userData.health === undefined) obj.userData.health = 100;

                    const oldBar = obj.getObjectByName('healthBar');
                    if (oldBar) obj.remove(oldBar);

                    const canvas = document.createElement('canvas');
                    canvas.width = 64; canvas.height = 8;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#00ff00';
                    ctx.fillRect(0, 0, 64, 8);

                    const tex = new THREE.CanvasTexture(canvas);
                    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
                    const sprite = new THREE.Sprite(mat);
                    sprite.name = 'healthBar';
                    sprite.scale.set(10, 1.25, 1);
                    sprite.position.y = 8;
                    obj.add(sprite);

                    this.crystals.push({ mesh: obj, sprite: sprite, tex: tex, ctx: ctx });
                }
            });
        }
    }

    updateModelHealthBars() {
        if (!this.crystals) return;
        this.crystals.forEach(c => {
            const hp = c.mesh.userData.health;
            if (hp < 100) {
                if (c.lastHp !== hp) {
                    const width = Math.max(0, (hp / 100) * 64);
                    c.ctx.clearRect(0, 0, 64, 8);
                    c.ctx.fillStyle = '#330000';
                    c.ctx.fillRect(0, 0, 64, 8);
                    c.ctx.fillStyle = hp < 30 ? '#ff0000' : '#00ff00';
                    c.ctx.fillRect(0, 0, width, 8);
                    c.tex.needsUpdate = true;
                    c.lastHp = hp;
                    c.sprite.visible = true;
                }
            } else {
                if (c.sprite) c.sprite.visible = false;
            }
        });
    }

    removeHUD() {
        if (this.hud) {
            this.hud.remove();
            this.hud = null;
        }
    }
}
