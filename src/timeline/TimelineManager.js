import { neuralAudio } from '../audio/NeuralAudio.js';

export class TimelineManager {
    constructor(viewer) {
        this.viewer = viewer; // Main viewer reference
        this.currentIndex = 0;
        this.models = [];

        // DOM Elements
        this.overlay = document.getElementById('timeline-overlay');
        this.track = document.getElementById('timeline-track');
        this.yearLabel = document.getElementById('timeline-year');
        this.titleLabel = document.getElementById('timeline-title');
        this.descLabel = document.getElementById('timeline-desc');

        // Bind Methods
        this.setup = this.setup.bind(this);
        this.enter = this.enter.bind(this);
        this.exit = this.exit.bind(this);
        this.goTo = this.goTo.bind(this);
    }

    setup(models, onExitCallback) {
        this.onExit = onExitCallback;
        // Sort Chronologically (Old -> New)
        this.models = [...models].sort((a, b) => a.year - b.year);

        if (!this.track) return;
        this.track.innerHTML = '';

        this.models.forEach((model, index) => {
            if (!model.crystals || model.crystals.length === 0) return;

            const node = document.createElement('div');
            node.className = 'timeline-node';
            node.dataset.index = index;
            node.innerHTML = `
                <div class="node-dot"></div>
                <span class="node-year">${model.year}</span>
                <span class="node-label">${model.name}</span>
            `;
            node.addEventListener('click', () => {
                this.stopAutoPlay();
                this.goTo(index);
                // Audio Init on interaction
                if (neuralAudio) neuralAudio.playCrystalSound(model);
            });
            this.track.appendChild(node);
        });

        // Event Listeners
        const btnPrev = document.getElementById('btn-prev-model');
        const btnNext = document.getElementById('btn-next-model');
        const btnClose = document.getElementById('btn-close-timeline');
        const btnAudio = document.getElementById('btn-toggle-audio');

        if (btnAudio) btnAudio.onclick = () => {
            if (neuralAudio) {
                const isMuted = neuralAudio.toggleMute();
                btnAudio.textContent = isMuted ? '🔇' : '🔊';

                // Play sound immediately if turning ON
                if (!isMuted) {
                    neuralAudio.playCrystalSound(this.models[this.currentIndex]);
                }
            }
        };

        if (btnPrev) btnPrev.onclick = () => {
            this.stopAutoPlay();
            if (this.currentIndex > 0) this.goTo(this.currentIndex - 1);
        };
        if (btnNext) btnNext.onclick = () => {
            this.stopAutoPlay();
            if (this.currentIndex < this.models.length - 1) this.goTo(this.currentIndex + 1);
        };
        if (btnClose) btnClose.onclick = () => {
            this.exit();
            if (this.onExit) this.onExit();
        };

        // Auto-Tour Button
        const btnAuto = document.getElementById('btn-auto-tour');
        if (btnAuto) {
            btnAuto.onclick = () => this.toggleAutoPlay();
        }
    }

    enter() {
        if (this.overlay) this.overlay.classList.remove('hidden');

        // Audio Init
        neuralAudio.init();
        neuralAudio.resume();

        // Sync Audio Button
        const btnAudio = document.getElementById('btn-toggle-audio');
        if (btnAudio) {
            btnAudio.textContent = neuralAudio.isMuted ? '🔇' : '🔊';
        }

        // Hide Main UI Opacity
        const nav = document.querySelector('.gallery-nav');
        const details = document.querySelector('.artifact-details');
        const headerWithStatus = document.querySelector('.gallery-header');

        if (nav) { nav.style.opacity = '0'; nav.style.pointerEvents = 'none'; }
        if (details) details.style.opacity = '0';
        if (headerWithStatus) headerWithStatus.style.opacity = '0';

        // Select First if not playing
        if (!this.isPlaying) this.goTo(0);

        // Sync UI
        if (window.updateModeUI) window.updateModeUI('timeline');
    }

    exit() {
        this.stopAutoPlay();

        if (this.overlay) this.overlay.classList.add('hidden');

        // Restore UI
        const nav = document.querySelector('.gallery-nav');
        const details = document.querySelector('.artifact-details');
        const header = document.querySelector('.gallery-header');

        if (nav) { nav.style.opacity = '1'; nav.style.pointerEvents = 'auto'; }
        if (details) details.style.opacity = '1';
        if (header) header.style.opacity = '1';
    }

    goTo(index) {
        this.currentIndex = index;
        const model = this.models[index];
        if (!model) return;

        // Active Node
        document.querySelectorAll('.timeline-node').forEach(n => {
            n.classList.remove('active');
            if (parseInt(n.dataset.index) === index) {
                n.classList.add('active');
                n.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        });

        // Animate Info
        if (this.yearLabel) this.yearLabel.style.opacity = 0;
        if (this.titleLabel) this.titleLabel.style.opacity = 0;
        if (this.descLabel) this.descLabel.style.opacity = 0;

        setTimeout(() => {
            if (this.yearLabel) this.yearLabel.textContent = model.year;
            if (this.titleLabel) this.titleLabel.textContent = model.name;
            if (this.descLabel) this.descLabel.textContent = model.desc;

            if (this.yearLabel) this.yearLabel.style.opacity = 1;
            if (this.titleLabel) this.titleLabel.style.opacity = 1;
            if (this.descLabel) this.descLabel.style.opacity = 1;

            // Trigger Sound
            neuralAudio.playCrystalSound(model);

        }, 200);

        // Load Crystal
        const crystal = model.crystals[0];
        if (this.viewer && crystal) {
            this.viewer.loadCrystal(`./${crystal.file}`).catch(e => console.error(e));
        }

        // Update Cortex Compatibility
        if (window.cortexUI) window.cortexUI.setModel(model);
    }

    // --- CINEMATIC AUTO-TOUR ---

    toggleAutoPlay() {
        if (this.isPlaying) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }
    }

    startAutoPlay() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        neuralAudio.resume();

        const btn = document.getElementById('btn-auto-tour');
        if (btn) {
            btn.textContent = '⏹ STOP TOUR';
            btn.style.background = 'rgba(0, 243, 255, 0.2)';
        }

        this.scheduleNextStep();
    }

    stopAutoPlay() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.playTimer) clearTimeout(this.playTimer);

        const btn = document.getElementById('btn-auto-tour');
        if (btn) {
            btn.textContent = '▶ AUTO-TOUR';
            btn.style.background = 'transparent';
        }

        // Ensure crystal is visible
        if (this.viewer && this.viewer.setThinning) {
            this.viewer.setThinning(0.0);
        }
    }

    scheduleNextStep() {
        if (!this.isPlaying) return;

        // --- CINEMATIC ACTION ---
        // 1. Zoom In (Dolly)
        if (this.viewer && this.viewer.setTargets) {
            // Pick a random angle or just zoom in
            const zoom = 0.5 + Math.random() * 0.5; // Random zoom 0.5 - 1.0 multiplier
            // Actually, let's use global uniforms or a helper if available.
            // Since we don't have a full camera director, let's use the 'AutoRotate' speed 
            // and perform a stylized "Explosion" prepare.

            if (this.viewer.setAutoRotateSpeed) this.viewer.setAutoRotateSpeed(5.0); // Fast spin
        }

        // Wait 4 seconds (viewing time)
        this.playTimer = setTimeout(() => {
            if (this.viewer && this.viewer.setAutoRotateSpeed) this.viewer.setAutoRotateSpeed(2.0); // Reset speed
            this.performTransition();
        }, 4000);
    }

    performTransition() {
        if (!this.isPlaying) return;

        // Sound Effect
        neuralAudio.playGlitch();

        // --- DRAMATIC TRANSITION ---
        // "Recall" Effect: Explode lines out, then fade.
        if (this.viewer && this.viewer.customUniforms) {
            // 1. Explosion (Push lines away)
            if (this.viewer.setLineDist) this.viewer.setLineDist(0.0); // Collapse lines? Or 500? Less dist = less lines visible usually.
            // Actually, let's use thinning + density to "glitch" out.
            if (this.viewer.setLineDensity) this.viewer.setLineDensity(0.0);
            if (this.viewer.setNodeDensity) this.viewer.setNodeDensity(0.0);
            if (this.viewer.setThinning) this.viewer.setThinning(1.0);
        }

        // 2. Wait for Glitch (1s)
        this.playTimer = setTimeout(() => {
            if (!this.isPlaying) return;

            // 3. Advance Model
            let nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.models.length) {
                nextIndex = 0;
            }

            this.goTo(nextIndex);

            // 4. Reveal (Dramatic Re-assembly)
            this.playTimer = setTimeout(() => {
                if (!this.viewer) return;

                // Reset to full
                if (this.viewer.setLineDist) this.viewer.setLineDist(200.0);
                if (this.viewer.setLineDensity) this.viewer.setLineDensity(1.0);
                if (this.viewer.setNodeDensity) this.viewer.setNodeDensity(1.0);
                if (this.viewer.setThinning) this.viewer.setThinning(0.0);

                // 5. Schedule Next
                this.scheduleNextStep();
            }, 800);

        }, 1000);
    }
}

export const timelineManager = new TimelineManager();
