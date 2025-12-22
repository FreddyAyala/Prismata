export class NeuralAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.delayNode = null;
        this.delayFeedback = null;
        this.isMuted = true; // Start Muted by default
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Master Chain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;

        // SCI-FI DELAY LINE (Space Effect)
        this.delayNode = this.ctx.createDelay();
        this.delayNode.delayTime.value = 0.4; // 400ms echo

        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.4; // 40% feedback

        // Routing: Master -> Delay -> Feedback -> Delay -> Master
        this.masterGain.connect(this.ctx.destination);

        this.masterGain.connect(this.delayNode);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayNode.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.ctx) {
            // Smooth mute avoiding clicks
            const now = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now);
            this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.3, now + 0.1);
        }
        return this.isMuted;
    }

    // --- SYNTHESIS TOOLS ---

    // Quantize freq to C Minor Pentatonic Scale to ensure "Nice" sounds
    quantize(freq) {
        // C Minor Pentatonic Ratios: 1, 1.2, 1.33, 1.5, 1.8 (C, Eb, F, G, Bb)
        // Find nearest ratio
        const ratios = [1.0, 1.2, 1.333, 1.5, 1.777, 2.0];
        // We assume 'freq' is roughly in the ballpark, but let's just stick to a fixed set of notes
        // closest to the input freq.
        // Actually, let's just snap input freq to strict Frequency table
        // C2=65.41, Eb2=77.78, F2=87.31, G2=98.00, Bb2=116.54
        // Base pitches we support:
        const scale = [
            65.41, 77.78, 87.31, 98.00, 116.54, // Octave 2
            130.81, 155.56, 174.61, 196.00, 233.08, // Octave 3
            261.63, 311.13, 349.23, 392.00, 466.16, // Octave 4
            523.25 // C5
        ];

        let closest = scale[0];
        let minDiff = Infinity;
        for (let note of scale) {
            const diff = Math.abs(note - freq);
            if (diff < minDiff) {
                minDiff = diff;
                closest = note;
            }
        }
        return closest;
    }

    playSound(targetFreq, type, duration, vol = 0.5, pan = 0, attack = 0.1) {
        if (!this.ctx || this.isMuted) return;

        const freq = this.quantize(targetFreq);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        // Lowpass Filter for "Warmth" (Human Agreeable)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = type === 'sawtooth' ? 1200 : 3000; // Cut harsh highs
        filter.Q.value = 1;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Soft Envelope (Pad-like)
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + attack); // Lush Attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Long Tail

        panner.pan.value = pan;

        // Chain: Osc -> Filter -> Gain -> Panner -> Master
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);

        osc.start();
        osc.stop(now + duration + 1.0); // Allow tail
    }

    playSuperSaw(freq, duration, vol = 0.3) {
        if (!this.ctx || this.isMuted) return;
        // 3 Detuned Saws for "Thick" Sci-Fi sound
        this.playSound(freq, 'sawtooth', duration, vol, 0, 0.5); // Center, Slow Attack
        this.playSound(freq * 1.005, 'sawtooth', duration, vol * 0.7, 0.4, 0.6); // Right
        this.playSound(freq * 0.995, 'sawtooth', duration, vol * 0.7, -0.4, 0.6); // Left
    }

    playGlitch() {
        if (!this.ctx || this.isMuted) return;
        // SUBTLE SWISH (Whoosh) instead of harsh bleeps
        const now = this.ctx.currentTime;

        // White Noise Buffer (created on fly or cached)
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5s
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(800, now + 0.2); // Up sweep
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.5); // Down sweep

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, now); // Very Quiet
        gain.gain.linearRampToValueAtTime(0.1, now + 0.2);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        src.start(now);
        src.stop(now + 0.5);
    }

    // --- GENERATIVE LOGIC ---

    // 1. Deterministic Hash (The "DNA" of the sound)
    // Cypher: Turns string (e.g. "gemini3") into a 32-bit integer seed
    getHash(str) {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    }

    // 2. Seeded Random (LCG)
    // Returns 0.0 to 1.0 based on the seed
    seededRandom(seed) {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    playCrystalSound(model) {
        if (!this.ctx) this.init();
        this.resume();
        if (this.isMuted) return;

        // --- UNIQUE SIGNATURE GENERATION ---

        // 1. The Seed: "gemini3" -> 348205...
        const seedStr = (model.id || model.name) + (model.year || 0);
        const seed = this.getHash(seedStr);

        // 2. Base Pitch (Year + Micro-shift)
        // Eras set the "Octave" / Range
        let octave = 3;
        if (model.year > 2020) octave = 4;
        if (model.year < 2000) octave = 2;

        // The unique "Root Note" for this model (C, D, E, G, A)
        // We pick one of 5 notes in the Pentatonic scale based on the seed
        const roots = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4 D4 E4 G4 A4
        const rootIdx = Math.floor(this.seededRandom(seed) * roots.length);
        let baseFreq = roots[rootIdx] * Math.pow(2, octave - 4); // Transpose to correct octave

        const duration = 4.0;

        // 3. GENERATE UNIQUE MELODY (THE SIGNATURE)
        // Every model gets a unique 4-note motif.
        const motif = [];
        for (let i = 0; i < 4; i++) {
            // Rnd -> 0 to 4 (Pentatonic steps)
            const step = Math.floor(this.seededRandom(seed + i * 111) * 5);
            // Multipliers: Unison, Major 2nd, Major 3rd, Perfect 5th, Major 6th
            const interval = [1, 1.125, 1.25, 1.5, 1.66][step];
            motif.push(interval);
        }

        // 4. PLAY THE SOUNDSCAPES based on Type
        let type = model.type || 'Unknown';
        let isComplex = (model.year > 2018 || type.includes('Multimodal'));

        if (isComplex) {
            // GLASS PADS (Modern)
            // Stack of Pure Sines with Detune (Chorus Effect)
            // Fundamental
            this.playSound(baseFreq, 'sine', duration, 0.3, 0, 0.8);
            // Slight Detune Right
            this.playSound(baseFreq * 1.002, 'sine', duration, 0.2, 0.5, 1.0);
            // Slight Detune Left
            this.playSound(baseFreq * 0.998, 'sine', duration, 0.2, -0.5, 1.0);

            // Fifth (Ethereal)
            this.playSound(baseFreq * 1.5, 'sine', duration, 0.15, 0, 1.2);

            // Play the MOTIF (The Signature) - High Bell Tones
            motif.forEach((interval, i) => {
                setTimeout(() => {
                    const f = baseFreq * interval * 2; // High octave
                    const p = (this.seededRandom(seed + i * 20) * 2) - 1;
                    // Very soft ping
                    this.playSound(f, 'sine', 0.8, 0.05, p, 0.1);
                }, 400 + (i * 200));
            });

        } else {
            // ANALOG DEEP (Classic)
            // Deep Sine
            this.playSound(baseFreq, 'sine', duration, 0.4, 0, 0.5);
            // Octave Lower
            this.playSound(baseFreq * 0.5, 'sine', duration, 0.3, 0, 0.5);

            // Play the MOTIF (Subtle)
            motif.forEach((interval, i) => {
                setTimeout(() => {
                    const f = baseFreq * interval;
                    // Soft pulse
                    this.playSound(f, 'sine', 0.5, 0.1, 0, 0.2);
                }, 200 + (i * 400));
            });
        }
    }
}

export const neuralAudio = new NeuralAudio();
