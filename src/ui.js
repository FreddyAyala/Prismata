import { CrystalViewer } from './main.js';
import { archiveManager } from './archive/ArchiveManager.js';
import { timelineManager } from './timeline/TimelineManager.js';
import { initGallery } from './ui/Gallery.js';
import { setupControls } from './ui/Controls.js';
import { setActivePanelStyle } from './ui/Panels.js';
import { ModeManager } from './ui/Modes.js';

// State
let activeSlot = 'main'; // 'main' or 'compare'
const viewers = {
  main: null,
  compare: null
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
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
      // 4. Setup Controls
      setupControls({
        viewers,
        activeSlotGetter: getActiveSlot,
        setActiveSlotCallback: setActiveSlot
      });

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

      // Init Archive
      archiveManager.init('archive-root');
    }

  // 7. Panel Click Listeners
  const panelA = document.getElementById('panel-a');
  const panelB = document.getElementById('panel-b');
  if (panelA) panelA.addEventListener('click', () => setActiveSlot('main'));
  if (panelB) panelB.addEventListener('click', () => setActiveSlot('compare'));

  // Initial State
  setActiveSlot('main');
});
