import { neuralAudio } from '../audio/NeuralAudio.js';
import { cortex } from '../ai/Cortex.js';

export class CortexUI {
    constructor(viewer) {
        this.viewer = viewer;
        this.container = null;
        this.input = null;
        this.status = null;
        this.isInit = false;

        // Scramble state
        this.scrambleInterval = null;

        this.init();
    }

    // SCI-FI TEXT SCRAMBLER
    scrambleText(element, finalText, duration = 800) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let iterations = 0;
        const maxIterations = finalText.length * 3;

        if (this.scrambleInterval) clearInterval(this.scrambleInterval);

        this.scrambleInterval = setInterval(() => {
            element.innerHTML = finalText.split('')
                .map((char, index) => {
                    if (index < iterations) return char;
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');

            if (iterations >= finalText.length) {
                clearInterval(this.scrambleInterval);
                element.innerHTML = finalText; // Ensure clean end
            }
            iterations += 1 / 2; // Speed control
        }, 30);
    }

    init() {
        // Create Terminal UI
        this.container = document.createElement('div');
        this.container.className = 'cortex-terminal';
        // Scanline Animation Injection
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes termOpen {
                0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
                50% { transform: translateX(-50%) scaleY(0.01); opacity: 1; }
                100% { transform: translateX(-50%) scaleY(1); opacity: 1; }
            }
            @keyframes borderPulse {
                0% { box-shadow: 0 0 10px rgba(0,243,255,0.1); border-color: rgba(0,243,255,0.3); }
                50% { box-shadow: 0 0 25px rgba(0,243,255,0.5); border-color: rgba(0,243,255,0.8); }
                100% { box-shadow: 0 0 10px rgba(0,243,255,0.1); border-color: rgba(0,243,255,0.3); }
            }
            .cortex-active {
                animation: borderPulse 1s infinite;
            }
        `;
        document.head.appendChild(style);

        // Responsive Styles
        const responsiveStyle = document.createElement('style');
        responsiveStyle.innerHTML = `
            @media (max-width: 600px) {
                .cortex-terminal {
                    width: 95% !important;
                    height: auto !important;
                    bottom: 70px !important; /* Above Dock (60px) + padding */
                    top: auto !important; 
                    left: 50% !important;
                    transform: translateX(-50%) !important; 
                    padding: 15px !important;
                    border: 1px solid var(--color-primary) !important;
                    box-shadow: 0 -5px 20px rgba(0,0,0,0.8) !important;
                    border-bottom: none !important; /* Merge with dock visually if desired, or keep separated */
                    border-radius: 10px 10px 0 0 !important;
                }
                .cortex-terminal input {
                    font-size: 16px !important;
                }
            }
        `;
        document.head.appendChild(responsiveStyle);

        this.container.style.cssText = `
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%) scaleY(0); /* Start closed */
            width: 400px;
            background: rgba(10, 15, 20, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 243, 255, 0.3);
            border-radius: 4px;
            padding: 15px;
            z-index: 9999;
            font-family: 'Courier New', Courier, monospace;
            box-shadow: 0 0 20px rgba(0, 243, 255, 0.1);
            transition: opacity 0.5s, transform 0.3s;
            opacity: 0; 
            pointer-events: none;
            overflow: hidden;
        `;

        this.status = document.createElement('div');
        this.status.style.color = '#00f3ff';
        this.status.style.fontSize = '12px';
        this.status.style.marginBottom = '5px';
        this.status.style.textShadow = '0 0 5px rgba(0,243,255,0.5)';
        this.status.innerText = "CORTEX_LINK: OFFLINE";
        this.container.appendChild(this.status);

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Query Neural Database...';
        this.input.style.cssText = `
            width: 100%;
            background: rgba(0,0,0,0.5);
            border: none;
            border-bottom: 2px solid #00f3ff;
            color: white;
            padding: 8px;
            font-family: inherit;
            outline: none;
            font-size: 14px;
            text-transform: uppercase;
        `;
        this.container.appendChild(this.input);

        document.body.appendChild(this.container);

        // Global Toggle (Backquote / ~)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote') {
                e.preventDefault();
                const isHidden = this.container.style.display === 'none' || this.container.style.opacity === '0';
                this.toggleDisplay(isHidden);
            }
        });

        // Event Listeners
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.processQuery(this.input.value);
            }
        });

        // Initialize Cortex AI
        cortex.init((stage, progress) => {
            if (stage === 'loading') {
                this.status.innerText = `INITIALIZING NEURAL ENGINE... ${Math.round(progress)}%`;
                // Animate Open
                this.container.style.animation = 'termOpen 0.4s forwards';
                this.container.style.pointerEvents = 'auto';
            } else if (stage === 'ready') {
                this.status.innerText = "CORTEX_LINK: ONLINE";
                this.container.style.animation = 'termOpen 0.4s forwards';
                this.container.style.pointerEvents = 'auto';
            } else if (stage === 'error') {
                this.status.innerText = "CORTEX FAILURE: OFFLINE";
                this.status.style.color = '#ff0055';
                this.container.style.opacity = '1';
                this.container.style.transform = 'translateX(-50%) scaleY(1)';
            } else if (stage === 'paused') {
                // STANDBY STATE (Waiting for User)
                this.status.innerHTML = "[ SYSTEM STANDBY ]<br><span style='color:white; opacity:0.7'>TAP TO INITIALIZE NEURAL INTERFACE</span>";
                this.status.style.color = '#00f3ff';
                this.container.style.animation = 'termOpen 0.5s forwards'; // Open effect
                this.container.style.cursor = 'pointer';
                this.container.style.pointerEvents = 'auto';
                this.input.style.display = 'none';

                const activate = () => {
                    // AUDIO WAKE UP
                    if (!neuralAudio.ctx) neuralAudio.init();
                    neuralAudio.resume();
                    if (neuralAudio.isMuted) neuralAudio.toggleMute(); // Force Unmute on interaction
                    neuralAudio.playGlitch(); // SFX

                    this.status.innerHTML = "ESTABLISHING NEURAL LINK... <span style='color:#ffaa00'>DOWNLOADING MODEL (20MB)</span>";
                    this.container.removeEventListener('click', activate);
                    this.container.style.cursor = 'default';

                    cortex.init((s, p) => {
                        if (s === 'loading') {
                            this.status.innerText = `DOWNLOADING NEURAL ENGINE... ${Math.round(p)}%`;
                        }
                        if (s === 'ready') {
                            // Use Scramble Effect for final ready state
                            this.scrambleText(this.status, "NEURAL LINK: ESTABLISHED");
                            this.status.style.color = '#00ffaa';

                            this.input.style.display = 'block';
                            this.input.placeholder = "Query Neural Database...";
                            this.input.focus();
                            neuralAudio.playGlitch(); // SFX
                        }
                    }, true);
                };
                this.container.addEventListener('click', activate);
            }
        });
    }

    setModel(model) {
        this.currentModel = model;
        // Reset state
        this.container.style.display = 'block';
        if (this.isInit) {
            this.status.innerHTML = "CORTEX_LINK: READY";
            this.input.placeholder = "Query Neural Database...";
            this.input.style.display = 'block';
        }

        // Feature: Primitive Mode
        if (model.year < 2013) {
            this.input.placeholder = "INPUT DATA TO SIMULATE FLOW...";
            this.status.innerHTML = "NEURAL LINK: <span style='color:#ffaa00'>PRIMITIVE COMPATIBILITY MODE</span>";
        }
    }

    async processQuery(text) {
        if (!text) return;

        // Clear input immediately
        this.input.value = '';
        this.input.focus();

        // Check for Primitive Mode
        const isPrimitive = this.currentModel && this.currentModel.year < 2013;

        this.status.innerText = isPrimitive
            ? "SIMULATING ACTIVATION FLOW..."
            : "PROCESSING VECTOR...";
        this.status.style.color = '#ffaa00';

        // SFX - Init
        if (neuralAudio && neuralAudio.ctx) {
            neuralAudio.playSound(800, 'sine', 0.1, 0.1);
        }

        // --- PATH A: PRIMITIVE SIMULATION (LeNet, Perceptron, etc) ---
        if (isPrimitive) {
            const id = this.currentModel.id;
            const name = this.currentModel.name;

            // 1. AI WINTER (1974) - The Void
            // "Cannot Compute" - Historical Easter Egg
            if (id === 'ai_winter') {
                this.status.innerHTML = "STATUS: <span style='color:#00f3ff'>RELOCATING RESOURCES...</span>";
                if (neuralAudio) neuralAudio.playSound(100, 'square', 1.0, 0.2); // Low drone

                setTimeout(() => {
                    this.status.innerHTML = "ERROR: <span style='color:#ff0055'>FUNDING CUT. PROJECT FROZEN.</span>";
                    if (neuralAudio) neuralAudio.playSound(60, 'sawtooth', 2.0, 0.4); // Fail sound
                }, 1500);
                return;
            }

            // 2. ALEXNET (2012) & CNNs - Expect Images
            // If it's a CNN but not LeNet (which takes digits), it probably wants complex images.
            if (id === 'alexnet') {
                this.status.innerHTML = "INPUT ERROR: <span style='color:#ff0055'>EXPECTED 227x227 RGB IMAGE</span>";
                if (neuralAudio) neuralAudio.playSound(150, 'sawtooth', 0.5, 0.5);
                return;
            }

            // 3. LSTM (1997) - SEQUENCE MODEL
            // Check: Text is VALID for LSTM (It reads sequences!)
            if (id === 'lstm') {
                // Simulation: "Reading" token by token
                const duration = Math.min(text.length * 200, 2000); // Max 2s
                this.status.innerText = `PROCESSING SEQUENCE: "${text.substring(0, 15)}..."`;

                // Spin the Helix
                if (this.viewer && this.viewer.setAutoRotateSpeed) {
                    this.viewer.setAutoRotateSpeed(20.0); // Fast spin
                    setTimeout(() => this.viewer.setAutoRotateSpeed(2.0), duration);
                }

                // Audio: Rapid ticking (Reading)
                const count = Math.min(text.length, 10);
                for (let i = 0; i < count; i++) {
                    setTimeout(() => {
                        if (neuralAudio) neuralAudio.playSound(600 + (Math.random() * 200), 'square', 0.05, 0.1);
                    }, i * 150);
                }

                setTimeout(() => {
                    this.status.innerText = "SEQUENCE PREDICTED";
                    this.status.style.color = '#00ffaa';
                }, duration);
                return;
            }

            // 4. PERCEPTRON (1958) & MLP (1986) - NUMBERS/LOGIC
            // LeNet is handled below (Digits)
            // Perceptron/MLP might prefer numbers but text is "encoded" in user imagination

            // LeNet Specific Check (Digits Only)
            if (name.toLowerCase().includes("lenet")) {
                const isDigit = /^\d+$/.test(text.trim());
                if (!isDigit) {
                    this.status.innerHTML = "INPUT ERROR: <span style='color:#ff0055'>TENSOR SHAPE MISMATCH (EXPECTED DIGIT)</span>";
                    this.status.style.color = '#ff0055';
                    if (neuralAudio) neuralAudio.playSound(150, 'sawtooth', 0.5, 0.5);
                    return;
                }
            }

            // Default Primitive Flow (Sequential Activation)
            // Valid for LeNet (if passed check), Perceptron, MLP
            if (this.viewer) {
                const sequence = [
                    { dir: { x: 0, y: -1, z: 0 }, freq: 150 }, // Bottom
                    { dir: { x: 0.8, y: 0.2, z: 0 }, freq: 300 }, // Right
                    { dir: { x: -0.8, y: 0.2, z: 0 }, freq: 450 }, // Left
                    { dir: { x: 0, y: 1, z: 0 }, freq: 800 }    // Top
                ];

                sequence.forEach((step, i) => {
                    setTimeout(() => {
                        this.viewer.setFocus(step.dir, 2.5); // Strong flash
                        if (neuralAudio) neuralAudio.playSound(step.freq, 'sawtooth', 0.15, 0.1);
                    }, i * 400);
                });
            }

            setTimeout(() => {
                this.status.innerText = `OUTPUT BOUND: [${text.toUpperCase()}]`;
                this.status.style.color = '#00ffaa';
            }, 2000);

            setTimeout(() => {
                this.status.innerText = "NEURAL LINK: PRIMITIVE MODE";
                this.status.style.color = '#ffaa00';
            }, 4000);
            return;
        }

        // --- PATH C: TACTICAL OVERRIDE (Game Mode) ---
        // Check if we have a game reference attached (will be set by DoomGame)
        if (this.game && this.game.active) {
            const cmd = text.toUpperCase().trim();
            let response = null;

            if (cmd === 'PURGE' || cmd === 'KILL *') {
                if (this.game.enemies.length > 0) {
                    this.game.enemies.forEach(e => e.takeDamage(999));
                    response = "TACTICAL NUKE: DEPLOYED. AREA SECURED.";
                    if (neuralAudio) neuralAudio.playSound(100, 'low-saw', 1.0, 1.0);
                } else {
                    response = "NO HOSTILES DETECTED.";
                }
            } else if (cmd === 'FIREWALL' || cmd === 'SHIELD') {
                this.game.godMode = true;
                response = "FIREWALL PROTOCOL: ACTIVE (10s INVULNERABILITY)";
                setTimeout(() => {
                    if (this.game) {
                        this.game.godMode = false;
                        if (this.status) this.status.innerText = "FIREWALL PROTOCOL: EXPIRED";
                    }
                }, 10000);
            } else if (cmd === 'SUPPLY' || cmd === 'AMMO') {
                this.game.weapons.forEach(w => w.ammo = w.maxAmmo);
                if (this.game.ui) this.game.ui.updateHUD();
                response = "SUPPLY DROP: RECEIVED. WEAPONS CHARGED.";
            } else if (cmd === 'BOSS' || cmd === 'SUDO') {
                this.game.startBossWave();
                response = "FATAL ERROR: FORCING BOSS ENCOUNTER...";
            }
            // --- USER-DEFINED MONSTER CREATION ---
            else if (cmd.startsWith('CREATE ') || cmd.startsWith('SPAWN ') || cmd.startsWith('MAKE ')) {
                const desc = text.substring(text.indexOf(' ') + 1);
                if (this.game.director) {
                    this.game.director.spawnUserDefinedMonster(desc, "USER");
                    response = `FABRICATING ENTITY: "${desc.toUpperCase()}"`;
                }
            }

            if (response) {
                this.status.innerText = `COMMAND ACCEPTED: ${response}`;
                this.status.style.color = '#00ffaa';
                this.input.value = '';

                // Visual Feedback
                this.container.classList.add('cortex-active');
                setTimeout(() => this.container.classList.remove('cortex-active'), 1000);
                return;
            }
        }

        // --- PATH B: MODERN SEMANTIC SEARCH ---
        const result = await cortex.think(text);

        if (result) {
            console.log("Thought Vector:", result.focus);

            // Success Effect
            this.container.classList.add('cortex-active');
            this.status.innerText = `ACTIVATION: ${text.toUpperCase()}`;
            this.status.style.color = '#00ffaa';

            // SFX: HARD DATA PROCESSING
            if (neuralAudio && neuralAudio.ctx) {
                neuralAudio.playGlitch();
                const count = 30;
                for (let i = 0; i < count; i++) {
                    setTimeout(() => {
                        const freq = Math.random() > 0.5
                            ? 2000 + Math.random() * 2000
                            : 100 + Math.random() * 200;
                        const type = Math.random() > 0.5 ? 'square' : 'sawtooth';
                        neuralAudio.playSound(freq, type, 0.03, 0.05, 0, 0.005);
                    }, i * 15);
                }
            }

            // Visualize
            if (this.viewer) {
                this.viewer.setFocus(result.focus, 2.0);
            }

            // Reset
            setTimeout(() => {
                this.container.classList.remove('cortex-active');
                if (this.status.innerText.includes(text.toUpperCase())) {
                    this.status.innerText = "CORTEX_LINK: READY";
                    this.status.style.color = '#00f3ff';
                }
            }, 3000);
        }
    }

    toggleDisplay(isVisible) {
        console.log("Cortex Toggle:", isVisible);
        if (!this.container) return;

        // Kill animation to ensure visibility control
        this.container.style.animation = 'none';

        if (!isVisible) {
            this.container.style.opacity = '0';
            this.container.style.pointerEvents = 'none';
            // Wait for transition then hide
            setTimeout(() => {
                if (this.container.style.opacity === '0') {
                    this.container.style.display = 'none';
                }
            }, 500);
        } else {
            this.container.style.display = 'block';
            // Slight delay to allow display:block to apply before transition
            requestAnimationFrame(() => {
                this.container.style.opacity = '1';
                this.container.style.pointerEvents = 'auto';
                if (this.isInit) {
                    this.container.style.transform = 'translateX(-50%) scaleY(1)';
                }

                // Release Pointer Lock if in Game
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                this.input.focus();
            });
        }
    }

    showTacticalAlert(text, key) {
        if (!this.container) return;

        // Ensure visible
        this.toggleDisplay(true);
        // Position specifically for game (e.g., top center or just use existing)
        // For now, let's just use the status area but make it FLASH
        this.status.innerHTML = `⚠️ <span style="color:#ff0055">${text}</span> <br><span style="color:#ffffff; font-size:10px;">PRESS [${key}] TO EXECUTE</span>`;
        this.status.style.color = '#ffaa00';

        // Pulse effect
        this.container.classList.add('cortex-active');
        if (neuralAudio) neuralAudio.playSound(800, 'square', 0.2, 0.2); // Alert sound

        // Auto-clear after 5s
        setTimeout(() => {
            if (this.status.innerHTML.includes(text)) {
                this.container.classList.remove('cortex-active');
                this.status.innerHTML = "CORTEX_LINK: DATA STREAM MONITORING...";
                this.status.style.color = '#00f3ff';
                // Hide if not needed? No, let's keep it up contextually or user can hide
                // Actually, if we are in game, maybe we want it less obtrusive?
                // For now, standard display is fine.
            }
        }, 5000);
    }
}
