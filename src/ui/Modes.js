export class ModeManager {
  constructor(context) {
    this.context = context; // { timelineManager, archiveManager, viewers }
  }

  setup(models) {
    const { timelineManager, archiveManager } = this.context;
    const headerStatus = document.querySelector('.status-indicator');
    
    // --- MODE SWITCHER INIT ---
    if (headerStatus) {
        const modeSelect = document.createElement('select');
        modeSelect.id = 'mode-selector';
        modeSelect.className = 'minimal-btn';
        Object.assign(modeSelect.style, {
            marginRight: '20px',
            pointerEvents: 'auto',
            zIndex: '1000',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
            outline: 'none',
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.5)',
            textAlign: 'center',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '1px'
        });

        const modes = [
        { id: 'workbench', label: 'MODE: WORKBENCH', action: () => this.enterWorkbenchMode() },
        { id: 'timeline', label: 'MODE: TIMELINE', action: () => timelineManager.enter() },
        {
            id: 'archive', label: 'MODE: ARCHIVE', action: () => {
            if (models) {
                const sorted = [...models].sort((a, b) => a.year - b.year);
                this.enterArchiveMode(sorted);
            }
            }
        }
        ];

        modes.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.label;
            modeSelect.appendChild(opt);
        });

        modeSelect.addEventListener('change', (e) => {
            const mode = modes.find(m => m.id === e.target.value);
            if (mode) {
                modeSelect.style.boxShadow = '0 0 15px var(--color-primary)';
                setTimeout(() => modeSelect.style.boxShadow = 'none', 300);
                mode.action();
            }
        });

        headerStatus.insertBefore(modeSelect, headerStatus.firstChild);
    }
    
    // Auto-Bind Exit for Timeline/Archive
    // Timeline/Archive likely need a way to call "Back to Workbench"
    // We can inject this callback into them if they support it.
    if (archiveManager) archiveManager.onExit = () => this.enterWorkbenchMode();
    if (timelineManager) timelineManager.onExit = () => this.enterWorkbenchMode(); // Assuming timeline supports this property
    
    // Expose Global for external calls if needed
    window.updateModeUI = (activeId) => {
        const select = document.getElementById('mode-selector');
        if (select) select.value = activeId;
    };
  }
  
  enterWorkbenchMode() {
    const { timelineManager, archiveManager, viewers } = this.context;
    
    document.querySelector('.viewer-layout').classList.remove('hidden');
    document.querySelector('.ui-layer').classList.remove('hidden');

    timelineManager.exit();
    archiveManager.exitArchive();

    if (window.updateModeUI) window.updateModeUI('workbench');
    if (viewers.main) viewers.main.onResize();
  }

  enterArchiveMode(models) {
    const { timelineManager, archiveManager } = this.context;
    
    const layout = document.querySelector('.viewer-layout');
    const ui = document.querySelector('.ui-layer');
    if (layout) layout.classList.add('hidden');
    if (ui) ui.classList.add('hidden');

    timelineManager.exit();

    if (window.updateModeUI) window.updateModeUI('archive');

    if (models) {
        archiveManager.enterArchive(models);
    }
  }
}
