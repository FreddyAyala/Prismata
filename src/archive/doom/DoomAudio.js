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

    // Original Simple Sawtooth "Guitar" (from the version you liked)
    playSimpleGuitar(freq, duration) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000; // The "Original" crunch frequency

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

        // 0: Chill (Menu/Intermission), 1: E1M1 (Wave 1), 2: Sandy's City (Wave 2+), 3: Boss
        this.musicPhase = 0;
        let beat = 0;

        // PHASE 1: "At Doom's Gate" (E1M1) - Original A-Key Version
        // The user liked the "original" code which used A2 (110Hz) base
        const A2 = 110;
        const A3 = 220;
        const G3 = 196;
        const Fs3 = 185;
        const F3 = 174;
        const E3 = 164;
        const Eb3 = 155;

        // Main Riff Steps (16)
        // A A A' A A G A A F# A A F A A E Eb
        const mainRiff = [
            A2, A2, A3, A2, A2, G3, A2, A2, Fs3, A2, A2, F3, A2, A2, E3, Eb3
        ];

        // Part B: Move to D (IV)
        // D is 146.8 (D3)
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

        // Part C: Move to F (bVI) -> D (IV)
        // F3 Base = 174.6
        // This is usually a chord stab section in the real song, but adapting to riff style:
        // F Riff approx
        const F_Base = 174.6;
        const F_Oct = 349.2;
        const fRiff = [
            F_Base, F_Base, F_Oct, F_Base, F_Base, 311, F_Base, F_Base, 293, F_Base, F_Base, 277, F_Base, F_Base, 261, 246
        ];

        // Full "Song" Sequence:
        // Main x 2 -> D Riff x 1 -> Main x 1 -> F Riff x 1 -> D Riff x 1 -> Main x 1
        const fullE1M1 = [
            ...mainRiff, ...mainRiff,
            ...dRiff,
            ...mainRiff,
            ...fRiff,
            ...dRiff,
            ...mainRiff
        ];

        // Boss Phase 3
        const bossRiff = [65.4, 65.4, 110.0, 65.4, 65.4, 123.5, 65.4, 98.0];

        const tick = () => {
            if (!activeCheck()) return;

            // Phase 0: Chill
            if (this.musicPhase === 0) {
                if (beat % 32 === 0) this.playSound(55, 'sine', 3.0, 0.2);
            }
            // Phase 1: E1M1 (Original A-Key Tone)
            else if (this.musicPhase === 1) {
                const step = beat % fullE1M1.length;
                const note = fullE1M1[step];

                // Use the Simple Guitar (Saw + Lowpass @ 1000)
                this.playSimpleGuitar(note, 0.12);

                // Drums (Original style was simple, let's keep it rock)
                if (beat % 4 === 0) this.playNoise(0.1, 0.6, 0.8);
                if (beat % 4 === 2) this.playNoise(0.15, 0.5, 1.5, 600);
            }
            // Phase 2: Sandy's City (Keeping mapped for Wave 2+)
            else if (this.musicPhase === 2) {
                const bassNote = beat % 64 < 16 ? 73.4 : 69.3;
                if (beat % 8 === 0) this.playSimpleGuitar(bassNote, 0.2);
                if (beat % 4 === 2) this.playNoise(0.05, 0.1, 0.8, 2000);
            }
            // Phase 3: Boss
            else if (this.musicPhase === 3) {
                const note = bossRiff[beat % bossRiff.length];
                this.playSimpleGuitar(note, 0.1);
                if (beat % 2 === 1) this.playNoise(0.1, 0.5, 2.5, 500);
            }

            beat++;
            // 0: Chill, 1: E1M1 (150ms Original), 2: Sandy (200), 3: Boss (100)
            const interval = this.musicPhase === 3 ? 100 : (this.musicPhase === 1 ? 150 : (this.musicPhase === 2 ? 200 : 300));
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
}
