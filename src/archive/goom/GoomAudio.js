import * as THREE from 'three';

export class GoomAudio {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.noiseBuffer = this.createNoiseBuffer();

        // Music State
        this.musicPhase = 0;
        this.beat = 0;
        this.musicLoopOffset = null;
    }

    createNoiseBuffer() {
        if (!this.audioCtx) return null;
        const bufferSize = this.audioCtx.sampleRate * 2.0; 
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // --- CORE AUDIO GENERATORS ---

    playNoise(duration, vol = 1.0, rate = 1.0, highpass = 0, detune = 0) {
        if (!this.audioCtx || !this.noiseBuffer) return;
        const src = this.audioCtx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.playbackRate.value = rate;
        if (detune) src.detune.value = detune;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        if (highpass > 0) {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = highpass;
            src.connect(filter);
            filter.connect(gain);
        } else {
            src.connect(gain);
        }

        gain.connect(this.masterGain);
        src.start();
        src.stop(this.audioCtx.currentTime + duration);
    }

    playSound(freq, type, duration, vol, detune = 0) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        if (detune) o.detune.setValueAtTime(detune, this.audioCtx.currentTime);

        g.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        o.stop(this.audioCtx.currentTime + duration);
    }

    playSuperSaw(freq, vol, duration) {
        if (!this.audioCtx) return;
        // Oscillator 1: Body
        this.playSound(freq, 'sawtooth', duration, vol);
        // Oscillator 2: Detune (Chorus Effect)
        this.playSound(freq * 1.01, 'sawtooth', duration, vol * 0.7);
        // Oscillator 3: Sub Bass
        this.playSound(freq * 0.5, 'square', duration, vol * 0.5);
    }

    playVictorySong() {
        if (!this.audioCtx) return;

        // Stop sequencer
        this.musicPhase = 99; 

        // === CINEMATIC VICTORY ANTHEM ===
        // Style: Hans Zimmer / Doom Eternal Slow
        // Progression: C -> Ab -> Bb -> C (Heroic/Epic)

        const now = this.audioCtx.currentTime;

        // 1. THE "BRAAAM" DRONE (Low C)
        // Sustains through the whole sequence
        this.playSuperSaw(65.41, 0.4, 8.0); // C2
        this.playSuperSaw(32.70, 0.5, 8.0); // C1 (Sub)

        // 2. SLOW ORCHESTRAL CHORDS (SuperSaws simulating Brass)
        const chordProgression = [
            { t: 0.0, notes: [130.81, 196.00, 261.63], dur: 2.0 }, // C Major (C3, G3, C4)
            { t: 2.0, notes: [103.83, 155.56, 207.65], dur: 2.0 }, // Ab Major (Ab2, Eb3, Ab3) - The "Epic" shift
            { t: 4.0, notes: [116.54, 174.61, 233.08], dur: 1.5 }, // Bb Major (Bb2, F3, Bb3)
            { t: 5.5, notes: [130.81, 196.00, 261.63, 523.25, 1046.50], dur: 6.0 } // C Major FINALE (Huge Stack)
        ];

        chordProgression.forEach(c => {
            const start = now + c.t;
            c.notes.forEach((freq, i) => {
                // Detune slightly for ensemble effect
                setTimeout(() => {
                    this.playSuperSaw(freq, 0.25, c.dur);
                    this.playSuperSaw(freq * 1.005, 0.15, c.dur); // Detuned layer
                }, c.t * 1000);
            });
        });

        // 3. CINEMATIC PERCUSSION
        const hits = [0, 2.0, 4.0, 5.5];
        hits.forEach(t => {
            setTimeout(() => {
                this.playNoise(0.5, 0.6, 0.5, 100); // Low Impact Boom
                this.playCrash(); // Cymbal Wash
            }, t * 1000);
        });

        // 4. MELODY TRUMPETS (High Sawtooths)
        const melody = [
            { t: 5.5, f: 523.25 }, // C5
            { t: 5.8, f: 659.25 }, // E5
            { t: 6.1, f: 783.99 }, // G5
            { t: 6.4, f: 1046.50 } // C6 (High hold)
        ];

        melody.forEach(m => {
            setTimeout(() => {
                this.playSuperSaw(m.f, 0.2, 4.0);
            }, m.t * 1000);
        });
    }

    playCrash() {
        if (!this.audioCtx) return;
        // 1. White Noise Burst (Long decay)
        this.playNoise(1.5, 0.4, 0.8, 1000);
        // 2. High Sine (The metallic "Ping")
        this.playSound(4000, 'sine', 0.1, 0.05);
    }

    triggerGlitchEffect() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(3000, this.audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
    }

    // --- MUSIC SYSTEM (THE LOGIC) ---

    setMusicPhase(phase) {
        if (this.musicPhase === phase) return;
        console.log(`🎵 Switching Music Phase: ${this.musicPhase} -> ${phase}`);

        // Force transition
        this.musicPhase = phase;
        this.beat = 0;

        // Play a sound to cover the cut
        this.playNoise(0.5, 0.5, 1.0, 500);
    }

    playAlert() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Siren Effect: Sawtooth oscillating between 800Hz and 400Hz
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.linearRampToValueAtTime(400, now + 0.4);
        osc.frequency.linearRampToValueAtTime(800, now + 0.8);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + 0.8);
    }

    playMusic(activeCheck) {
        if (!this.audioCtx) return null;
        this.musicPhase = 0;
        this.beat = 0;

        const tick = () => {
            if (!activeCheck()) return;

            // --- GLOBAL SEQUENCER LOGIC ---
            const measure = Math.floor(this.beat / 16);
            const section = measure % 8; // 0-7 cycle for song structure

            // "Turnaround": The VERY LAST BEAT of a section (Beat 15, 31, 47...)
            const isTurnaround = (this.beat % 16 === 15);

            // "Section Start": The VERY FIRST BEAT of a new section
            const isSectionStart = (this.beat % 16 === 0 && measure > 0);

            // ==================================================
            // PHASE 0: INTRO (Dark Ambient)
            // ==================================================
            if (this.musicPhase === 0) {
                const root = 82.41;
                // Drone
                if (this.beat % 4 === 0) {
                    let note = (measure % 2 === 0) ? root : 77.78;
                    this.playSound(note, 'sine', 1.5, 0.4);
                }
                // Data Arp
                if (measure >= 0 && this.beat % 2 === 0) { // Changed to measure >= 0 for immediate intro
                    const scale = [659.25, 523.25, 783.99, 1046.50];
                    this.playSound(scale[this.beat % 4], 'square', 0.1, 0.05);
                }
                // Random Glitch
                if (Math.random() > 0.90) this.playNoise(0.5, 0.1, 0.2, 5000); // 0.90 for frequent glitches
            }

                // ==================================================
                // PHASE 1: E1M1 (Rock Structure)
                // ==================================================
            else if (this.musicPhase === 1) {
                // EXTENDED STRUCTURE (16 Measures ~ 30s loop)
                // Verse: Measures 0-7 (8 bars)
                // Chorus: Measures 8-11 (4 bars)
                // Bridge: Measures 12-15 (4 bars)
                const p1Section = measure % 16;

                // E1M1 RIFF (Chromatic Descent)
                const E2 = 82.41;
                const E3 = 164.81;
                const D3 = 146.83;
                const C3 = 130.81;
                const Bb2 = 116.54;

                const riff = [
                    E2, E2, E3, E2, E2, D3, E2, E2, C3, E2, E2, Bb2, // 12 beats
                    E2, E2, Bb2, C3 // Turnaround (4 beats)
                ];
                let note = riff[this.beat % 16];

                // 1. TRANSITION HANDLING
                // Crash only on major section changes (Measure 0, 8, 12) OR every 4th measure for energy
                if (isSectionStart && (p1Section === 0 || p1Section === 8 || p1Section === 12 || p1Section % 4 === 0)) {
                    this.playCrash();
                }

                // Turnarounds: Every 4 measures (End of Verse 1, Verse 2, Chorus, Bridge)
                const isPhraseEnd = (isTurnaround && (p1Section + 1) % 4 === 0);

                if (isPhraseEnd) {
                    // DRUM FILL
                    this.playNoise(0.1, 0.6, 2.5, 400); // Tom 1
                    setTimeout(() => this.playNoise(0.1, 0.6, 2.0, 300), 100); // Tom 2
                    setTimeout(() => this.playNoise(0.1, 0.6, 2.0, 200), 200); // Tom 3
                } else {
                    // 2. GUITAR
                    // Chorus: Measures 8-11
                    const isChorus = (p1Section >= 8 && p1Section < 12);
                    const isBridge = (p1Section >= 12);

                    if (isChorus) {
                        // CHORUS: Power Chords (E5 -> G5 -> A5)
                        const root = (this.beat % 32 < 16) ? E2 : ((this.beat % 16 < 8) ? 98.00 : 110.00);
                        if (this.beat % 4 === 0) {
                            this.playSuperSaw(root, 0.2, 0.4);
                            this.playSuperSaw(root * 1.5, 0.2, 0.4);
                        }
                    } else if (isBridge) {
                        // BRIDGE / SOLO
                        if (this.beat % 2 === 0) this.playSound(82.41, 'sawtooth', 0.15, 0.1);
                        const soloNote = [329, 392, 440, 493][(this.beat * 3) % 4];
                        this.playSound(soloNote, 'square', 0.15, 0.15);
                    } else {
                        // VERSE (0-7): The Riff
                        if (note) this.playSuperSaw(note, 0.25, 0.2);
                    }
                }

                // 3. DRUMS
                if (!isPhraseEnd) {
                    if (this.beat % 4 === 0) this.playNoise(0.3, 0.8, 1.2); // Kick
                    if (this.beat % 4 === 2) this.playNoise(0.2, 0.4, 1.5, 800); // Snare
                }
            }

                // ==================================================
                // PHASE 2: FAST METAL (Gallop)
                // ==================================================
            else if (this.musicPhase === 2) {
                let root = 82.41;
                if (section >= 4 && section < 6) root = 98.00;
                if (section >= 6) root = 110.00;

                if (isSectionStart) this.playCrash();

                if (isTurnaround) {
                    // Rapid Snare Fill
                    this.playNoise(0.05, 0.7, 3.0, 800);
                    setTimeout(() => this.playNoise(0.05, 0.7, 3.0, 800), 50);
                } else {
                    // Guitar Gallop (Iron Maiden style)
                    // Skip the 4th 16th note
                    if (this.beat % 4 !== 3) this.playSuperSaw(root, 0.22, 0.1);
                }

                // Drums (Techno/Metal)
                if (!isTurnaround) {
                    if (this.beat % 4 === 0) this.playNoise(0.4, 0.8, 1.0); // Kick
                    if (this.beat % 4 === 2) this.playNoise(0.1, 0.2, 0.5, 1500); // Clap
                }
            }

                // ==================================================
                // PHASE 3: SANDY'S CITY (Heavy Groove)
                // ==================================================
            else if (this.musicPhase === 3) {
                const bassSeq = [73.42, 73.42, 87.31, 73.42, 98.00, 87.31, 110.00, 73.42];
                const bNote = bassSeq[this.beat % 8];
                const isDubBreak = (section >= 6); // Last 2 measures are breakdown

                if (isSectionStart && !isDubBreak) this.playCrash();

                // 1. BASS
                if (this.beat % 2 === 0) {
                    if (isDubBreak) {
                        this.playSound(bNote, 'sine', 0.5, 0.3); // Deep Sub
                    } else {
                        this.playSuperSaw(bNote, 0.25, 0.25); // Heavy Guitar
                    }
                }

                // 2. CHORDS (Muted during breakdown)
                if (!isDubBreak && this.beat % 2 === 1) {
                    this.playSound(bNote * 2, 'sawtooth', 0.1, 0.1);
                    this.playSound(bNote * 3, 'sawtooth', 0.1, 0.1);
                }

                // 3. WHISTLE LEAD (Echoes)
                if (this.beat % 16 === 0 || this.beat % 16 === 12) {
                    this.playSound(587.33, 'sine', 0.2, 0.5);
                    setTimeout(() => this.playSound(587.33, 'sine', 0.1, 0.3), 240);
                }

                // 4. DRUMS
                if (this.beat % 4 === 0) this.playNoise(0.3, 0.8, 1.2); // Kick
                if (!isDubBreak && this.beat % 4 === 2) this.playNoise(0.2, 0.5, 2.0, 700); // Snare
            }

            // ==================================================
            // PHASE 4: PANIC (Rising)
            // ==================================================
            else if (this.musicPhase === 4) {
                const basePitch = 110.00 * Math.pow(1.059, section);
                const interval = [0, 3, 5, 7, 12][this.beat % 5];
                const note = basePitch * Math.pow(1.059, interval);

                this.playSound(note, 'square', 0.1, 0.1);
                if (Math.random() < 0.05) this.triggerGlitchEffect();

                if (this.beat % 2 === 0) this.playNoise(0.2, 0.4, 0.5);
                if (this.beat % 2 === 1) this.playNoise(0.1, 0.2, 0.2, 4000);
            }

            // ==================================================
            // PHASE 5: BOSS (Industrial)
            // ==================================================
            else if (this.musicPhase === 5) {
                // Polymeter Riff
                const rhythm = [1, 0, 0, 1, 0, 0, 1, 0];
                if (rhythm[this.beat % 8] === 1) {
                    this.playSuperSaw(55.00, 0.4, 0.15); // Low A
                }
                // Anvil Clang
                if (this.beat % 8 === 4) {
                    this.playSound(440, 'square', 0.2, 0.5);
                    this.playSound(440 * 1.41, 'square', 0.2, 0.5);
                }
                // Double Kick
                if (this.beat % 8 === 0 || this.beat % 8 === 1) {
                    this.playNoise(0.4, 1.0, 1.0);
                }
            }

            // --- TICK HANDLING ---
            this.beat++;
            let interval = 300;
            if (this.musicPhase === 1) interval = 110;
            if (this.musicPhase === 2) interval = 100;
            if (this.musicPhase === 3) interval = 120;
            if (this.musicPhase === 4) interval = 90;
            if (this.musicPhase === 5) interval = 100;

            this.musicLoopOffset = setTimeout(tick, interval);
        };

        tick();
        return { stop: () => { if (this.musicLoopOffset) clearTimeout(this.musicLoopOffset); } };
    }

    // --- SFX ---

    playWeaponSound(type) {
        if (!this.audioCtx) return;
        if (type === 'BLASTER') {
            this.playSound(800, 'sine', 0.1, 0.3);
            this.playSound(400, 'sawtooth', 0.05, 0.1);
        } else if (type === 'SHOTGUN') {
            this.playSound(60, 'square', 0.3, 0.6);
            this.playSound(100, 'sawtooth', 0.2, 0.4, -1200);
            this.playNoise(0.3, 0.8, 1.5, 500);
            setTimeout(() => this.playNoise(0.1, 0.4, 2.0, 1000), 500);
        } else if (type === 'LAUNCHER') {
            this.playSound(50, 'triangle', 0.5, 0.6);
            this.playNoise(0.6, 0.5, 0.5, 200);
        } else if (type === 'PLASMA') {
            this.playSound(1200, 'sawtooth', 0.1, 0.15);
            this.playSound(2000, 'square', 0.05, 0.1);
        } else if (type === 'BIG FREAKING GEMINI') {
            this.playSound(100, 'sawtooth', 2.0, 0.8);
            this.playNoise(2.0, 0.5, 0.2, 50);
        }
    }

    playJump() {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.linearRampToValueAtTime(150, t + 0.15);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.15);
    }

    playPickup(type = 'ammo') {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        if (type === 'health') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(1600, t + 0.2);
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.linearRampToValueAtTime(400, t + 0.05);
        }
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.2);
    }

    playPlayerPain() {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 0.25);
    }

    playMonsterPain(type) {
        const pitch = type === 'imp' ? 600 : (type === 'tank' ? 100 : 300);
        this.playSound(pitch, 'sawtooth', 0.3, 0.4, -500);
        this.playNoise(0.2, 0.5, 0.8);
    }

    playBossDeath() {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 2.0);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 2.0);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(t + 2.0);
    }



    updateListener(camera) {
        if (!this.audioCtx || !camera || !this.audioCtx.listener.positionX) return;
        const pos = camera.position;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        this.audioCtx.listener.positionX.value = pos.x;
        this.audioCtx.listener.positionY.value = pos.y;
        this.audioCtx.listener.positionZ.value = pos.z;
        this.audioCtx.listener.forwardX.value = forward.x;
        this.audioCtx.listener.forwardY.value = forward.y;
        this.audioCtx.listener.forwardZ.value = forward.z;
        this.audioCtx.listener.upX.value = up.x;
        this.audioCtx.listener.upY.value = up.y;
        this.audioCtx.listener.upZ.value = up.z;
    }

    // RESTORED 3D SOUND for Spawn/Teleport effects
    play3DSound(pos, freq, type, duration, vol, detune = 0) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        const panner = this.audioCtx.createPanner();

        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1.0;
        panner.maxDistance = 100.0;
        panner.rolloffFactor = 1.0;
        panner.positionX.value = pos.x;
        panner.positionY.value = pos.y;
        panner.positionZ.value = pos.z;

        o.type = type;
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        if (detune) o.detune.setValueAtTime(detune, this.audioCtx.currentTime);

        g.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        o.connect(g);
        g.connect(panner);
        panner.connect(this.masterGain ? this.masterGain : this.audioCtx.destination);

        o.start();
        o.stop(this.audioCtx.currentTime + duration);
    }
}
