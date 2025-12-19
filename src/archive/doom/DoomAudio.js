export class DoomAudio {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.noiseBuffer = this.createNoiseBuffer();
    }

    createNoiseBuffer() {
        if (!this.audioCtx) return null;
        const bufferSize = this.audioCtx.sampleRate * 2.0; // 2 seconds of noise
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playNoise(duration, vol = 1.0, rate = 1.0, highpass = 0, detune = 0) {
        if (!this.audioCtx || !this.noiseBuffer) return;
        const src = this.audioCtx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.playbackRate.value = rate;
        if (detune) src.detune.value = detune;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        let dest = gain;
        if (highpass > 0) {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = highpass;
            src.connect(filter);
            filter.connect(gain);
        } else {
            src.connect(gain);
        }

        gain.connect(this.masterGain ? this.masterGain : this.audioCtx.destination);
        src.start();
        src.stop(this.audioCtx.currentTime + duration);
    }

    // Original Simple Sawtooth "Guitar" (Tone Preserved)
    playSimpleGuitar(freq, duration) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000; 

        g.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        o.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain ? this.masterGain : this.audioCtx.destination);

        o.start();
        o.stop(this.audioCtx.currentTime + duration);
    }

    playMonsterPain(type) {
        const pitch = type === 'imp' ? 600 : (type === 'tank' ? 100 : 300);
        const wave = type === 'wraith' ? 'sine' : 'sawtooth';
        this.playSound(pitch, wave, 0.3, 0.4, type === 'imp' ? -500 : 0);
        this.playNoise(0.2, 0.5, 0.8);
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
        g.connect(this.audioCtx.destination);
        o.start();
        o.stop(this.audioCtx.currentTime + duration);
    }

    playWeaponSound(type) {
        if (!this.audioCtx) return;

        if (type === 'BLASTER') {
            this.playSound(800, 'sine', 0.1, 0.3);
            this.playSound(400, 'sawtooth', 0.05, 0.1);
        } else if (type === 'SHOTGUN') {
            this.playSound(60, 'square', 0.3, 0.6);
            this.playSound(100, 'sawtooth', 0.2, 0.4, -1200);
            this.playNoise(0.3, 0.8, 1.5, 500);
            setTimeout(() => {
                this.playNoise(0.1, 0.4, 2.0, 1000);
                setTimeout(() => this.playNoise(0.15, 0.3, 1.2, 200), 150);
            }, 500);
        } else if (type === 'LAUNCHER') {
            this.playSound(50, 'triangle', 0.5, 0.6);
            this.playNoise(0.6, 0.5, 0.5, 200);
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.5);
            g.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.5);
            osc.connect(g);
            g.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.5);
        } else if (type === 'PLASMA') {
            this.playSound(1200, 'sawtooth', 0.1, 0.15);
            this.playSound(2000, 'square', 0.05, 0.1);
        } else if (type === 'BFG 9000') {
            this.playSound(100, 'sawtooth', 2.0, 0.8);
            this.playNoise(2.0, 0.5, 0.2, 50);
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 1.0);
            g.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1.0);
            osc.connect(g);
            g.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 1.0);
        }
    }

    playMusic(activeCheck) {
        if (!this.audioCtx) return null;

        // 0: Chill, 1: E1M1 (Wave 1), 2: E1M4 (Wave 2+), 3: Boss
        this.musicPhase = 0; 
        let beat = 0;

        // --- PHASE 1: E1M1 (Original A-Key) ---
        const A2 = 110;
        const A3 = 220;
        const G3 = 196;
        const Fs3 = 185;
        const F3 = 174;
        const E3 = 164;
        const Eb3 = 155;

        // Main Riff
        const mainRiff = [
            A2, A2, A3, A2, A2, G3, A2, A2, Fs3, A2, A2, F3, A2, A2, E3, Eb3
        ];
        // D Riff (IV)
        const D3 = 146.8;
        const D4 = 293.7;
        const C4 = 261.6;
        const B3 = 246.9;
        const Bb3 = 233.1;
        const A3_ = 220.0;
        const Ab3 = 207.7;
        const dRiff = [
            D3, D3, D4, D3, D3, C4, D3, D3, B3, D3, D3, Bb3, D3, D3, A3_, Ab3
        ];
        // F Riff (VI)
        const F_Base = 174.6;
        const F_Oct = 349.2;
        const fRiff = [
            F_Base, F_Base, F_Oct, F_Base, F_Base, 311, F_Base, F_Base, 293, F_Base, F_Base, 277, F_Base, F_Base, 261, 246
        ];

        // Combined Structure: A A D A F D A
        const fullE1M1 = [...mainRiff, ...mainRiff, ...dRiff, ...mainRiff, ...fRiff, ...dRiff, ...mainRiff];

        // --- PHASE 2: E1M4 "Kitchen Ace" (A Fast Combat Track) ---
        // Fast, aggressive beat. Key of E.
        // E E E E ... Bb ... A ... G ...
        const E2 = 82.4;
        const Bb2 = 116.5;
        const G2 = 98.0;
        // Simple Fast Riff: E E E E E E Bb A G
        // 8 steps
        const e1m4Riff = [
            E2, E2, E2, E2, E2, E2, Bb2, A2
        ];

        // --- Boss Riff ---
        const bossRiff = [65.4, 65.4, 110.0, 65.4, 65.4, 123.5, 65.4, 98.0];

        const tick = () => {
            if (!activeCheck()) return;

            // Phase 0: Chill
            if (this.musicPhase === 0) {
                if (beat % 32 === 0) this.playSound(55, 'sine', 3.0, 0.2); 
            }
                // Phase 1: E1M1 (Varied)
            else if (this.musicPhase === 1) {
                const step = beat % fullE1M1.length;
                const note = fullE1M1[step];

                this.playSimpleGuitar(note, 0.12);

                // Lead Melody (Variety) - High Sine
                // Play on the "Turnaround" parts (Steps 32-48 and 64-96 roughly)
                if (step >= 32 && step < 48 && beat % 2 === 0) {
                    // Harmonies on D section
                    this.playSound(note * 2, 'sine', 0.1, 0.1);
                }
                if (step >= 64 && beat % 4 === 0) {
                    // Harmonies on F section
                    this.playSound(note * 3, 'triangle', 0.1, 0.05);
                }

                // Drums
                if (beat % 4 === 0) this.playNoise(0.1, 0.6, 0.8);
                if (beat % 4 === 2) this.playNoise(0.15, 0.5, 1.5, 600);
            } 
                // Phase 2: E1M4 (Fast Metal) - REPLACED Sandy's City
            else if (this.musicPhase === 2) {
                const note = e1m4Riff[beat % e1m4Riff.length];
                // Driving constant 16th notes
                this.playSimpleGuitar(note, 0.1);

                // Accent Hi-Hats every step for speed feeling
                this.playNoise(0.02, 0.05, 3.0, 4000); // Tsk tsk tsk tsk

                // Snare punch
                if (beat % 4 === 2) this.playNoise(0.1, 0.5, 2.0, 600);
            } 
            // Phase 3: Boss
            else if (this.musicPhase === 3) {
                const note = bossRiff[beat % bossRiff.length];
                this.playSimpleGuitar(note, 0.1);
                if (beat % 2 === 1) this.playNoise(0.1, 0.5, 2.5, 500); 
            }

            beat++;
            // 0: Chill, 1: E1M1 (150ms), 2: E1M4 (110ms FAST), 3: Boss (100ms)
            const interval = this.musicPhase === 3 ? 100 : (this.musicPhase === 1 ? 150 : (this.musicPhase === 2 ? 110 : 300));
            this.musicLoopOffset = setTimeout(tick, interval);
        };

        tick();
        return { stop: () => { if (this.musicLoopOffset) clearTimeout(this.musicLoopOffset); } };
    }

    setMusicPhase(phase) {
        this.musicPhase = phase;
    }

    playAlert() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.1);
        osc.frequency.linearRampToValueAtTime(600, now + 0.2);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);

        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(now + 0.4);
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
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(t + 2.0);
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.playNoise(0.2, 0.4, 0.2); 
            }, i * 400);
        }
    }

    playPlayerPain() {
        if (!this.audioCtx) return;
        // DOOM GRUNT: Low pitch descending sawtooth with lowpass
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.3);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, t);
        filter.Q.value = 1;

        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(t + 0.3);
    }
}
