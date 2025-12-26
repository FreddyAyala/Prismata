
import { CrystalViewer } from './main.js';
import { archiveManager } from './archive/ArchiveManager.js';
import { timelineManager } from './timeline/TimelineManager.js';
import { initGallery } from './ui/Gallery.js';
import { setupControls } from './ui/Controls.js';
import { setActivePanelStyle } from './ui/Panels.js';
import { ModeManager } from './ui/Modes.js';
import { ReleaseLog } from './ui/ReleaseLog.js'; // NEW IMPORT
import { injectTemplates } from './ui/Templates.js'; // TEMPLATES

// State
let activeSlot = 'main'; // 'main' or 'compare'
const viewers = {
  main: null,
  compare: null
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  // 0. Inject Templates (Refactor)
  injectTemplates();

  // 0b. Init Release Log (Independent)
  const releaser = new ReleaseLog();

  // 1. Init Viewers
  viewers.main = new CrystalViewer('view-main');
  viewers.compare = new CrystalViewer('view-compare');

  // 2. Helpers
  const getActiveSlot = () => activeSlot;
  const setActiveSlot = (slot) => {
    activeSlot = slot;
    setActivePanelStyle(slot);
  };

  // 3. Init Gallery & Load Models
  const models = await initGallery(getActiveSlot, viewers);

  if (models) {


      // 5. Setup Modes
      const modeManager = new ModeManager({
        timelineManager,
        archiveManager,
        viewers
      });
      modeManager.setup(models);

      // 6. Init Timeline
      timelineManager.viewer = viewers.main;
      timelineManager.setup(models, () => modeManager.enterWorkbenchMode());

    // 7. Init Performance Governor
    const { PerformanceGovernor } = await import('./ui/PerformanceGovernor.js');
    const governor = new PerformanceGovernor(viewers);
    governor.start();

    // 4. Setup Controls (Now with Governor)
    setupControls({
      viewers,
      activeSlotGetter: getActiveSlot,
      setActiveSlotCallback: setActiveSlot,
      governor // Pass instance
    });


      // Init Archive
      archiveManager.init('archive-root');
    }

  // 8. Init Cortex UI (Neural Interface)
  try {
    console.log("🖥️ UI: Initializing Cortex UI...");
    const { CortexUI } = await import('./ui/CortexUI.js');
    window.cortexUI = new CortexUI(viewers.main);
    console.log("✅ UI: Cortex UI Mounted to DOM");
  } catch (err) {
    console.error("❌ UI: Cortex UI Failed to Load:", err);
  }


  // 7. Panel Click Listeners
  const panelA = document.getElementById('panel-a');
  const panelB = document.getElementById('panel-b');
  if (panelA) panelA.addEventListener('click', () => setActiveSlot('main'));
  if (panelB) panelB.addEventListener('click', () => setActiveSlot('compare'));

  // Initial State
  setActiveSlot('main');
});
