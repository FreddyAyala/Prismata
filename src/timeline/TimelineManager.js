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
            node.addEventListener('click', () => this.goTo(index));
            this.track.appendChild(node);
        });

        // Event Listeners
        const btnPrev = document.getElementById('btn-prev-model');
        const btnNext = document.getElementById('btn-next-model');
        const btnClose = document.getElementById('btn-close-timeline');

        if (btnPrev) btnPrev.onclick = () => {
            if (this.currentIndex > 0) this.goTo(this.currentIndex - 1);
        };
        if (btnNext) btnNext.onclick = () => {
            if (this.currentIndex < this.models.length - 1) this.goTo(this.currentIndex + 1);
        };
        if (btnClose) btnClose.onclick = () => {
            this.exit();
            if (this.onExit) this.onExit();
        };
    }

    enter() {
        if (this.overlay) this.overlay.classList.remove('hidden');

        // Hide Main UI Opacity
        const nav = document.querySelector('.gallery-nav');
        const details = document.querySelector('.artifact-details');
        const headerWithStatus = document.querySelector('.gallery-header');

        if (nav) { nav.style.opacity = '0'; nav.style.pointerEvents = 'none'; }
        if (details) details.style.opacity = '0';
        if (headerWithStatus) headerWithStatus.style.opacity = '0';

        // Select First
        this.goTo(0);
        // Sync UI - We assume we have access to updateModeUI logic via window or callback
        if (window.updateModeUI) window.updateModeUI('timeline');
    }

    exit() {
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
        }, 200);

        // Load Crystal
        const crystal = model.crystals[0];
        if (this.viewer && crystal) {
            this.viewer.loadCrystal(`./${crystal.file}`).catch(e => console.error(e));
        }
    }
}

export const timelineManager = new TimelineManager();
