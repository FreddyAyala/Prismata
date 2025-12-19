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

        gain.connect(this.audioCtx.destination);
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
            // High pitch digital zap
            this.playSound(1200, 'sawtooth', 0.1, 0.15);
            this.playSound(2000, 'square', 0.05, 0.1);
        } else if (type === 'BFG 9000') {
            // Massive buildup sound
            this.playSound(100, 'sawtooth', 2.0, 0.8);
            this.playNoise(2.0, 0.5, 0.2, 50);

            // Rising pitch
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

        let noteIdx = 0;
        const notes = [110, 110, 220, 110, 110, 196, 110, 110, 185, 110, 110, 174, 110, 110, 164, 155];

        const playNote = () => {
            if (!activeCheck()) return;

            const freq = notes[noteIdx];
            noteIdx = (noteIdx + 1) % notes.length;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;

            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.15);
        };

        return setInterval(playNote, 150);
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

        // 1. Descending "Moan"
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 2.0); // Slow pitch down

        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 2.0);

        osc.connect(gain);
        gain.connect(this.masterGain); // Use masterGain if available, or destination? 
        // DoomAudio constructor doesn't show masterGain in view 681... 
        // It shows `gain.connect(this.audioCtx.destination)` in playAlert.
        // I should stick to destination if masterGain is not consistent.
        // Actually, let's use destination relative to context.
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(t + 2.0);

        // 2. Glitchy Noise Bursts
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.playNoise(0.2, 0.4, 0.2); // Random scratches
            }, i * 400);
        }
    }
}
