import { showToast, setActivePanelStyle, uiElements, handleLoadCrystal } from './Panels.js';

export function setupControls(context) {
  const { viewers, activeSlotGetter, setActiveSlotCallback } = context;

  const btnSpin = document.getElementById('btn-spin');
  const btnReset = document.getElementById('btn-reset');
  const btnToggleInfo = document.getElementById('btn-toggle-info');
  const toggleCompare = document.getElementById('compare-toggle');
  const viewCompare = document.getElementById('view-compare');
  const viewerContainer = document.getElementById('viewer-container');
  const panelB = document.getElementById('panel-b');

  // Shared View Controls
  if (btnReset) btnReset.addEventListener('click', () => {
    const slot = activeSlotGetter();
    if (slot === 'main' && viewers.main) viewers.main.resetView();
    else if (viewers.compare) viewers.compare.resetView();
  });

  if (btnSpin) btnSpin.addEventListener('click', (e) => {
    const isActive = e.target.classList.toggle('active');
    const slot = activeSlotGetter();
    if (slot === 'main' && viewers.main) viewers.main.setAutoRotate(isActive);
    else if (viewers.compare) viewers.compare.setAutoRotate(isActive);
  });

  // Info Toggle
  if (btnToggleInfo) {
    btnToggleInfo.addEventListener('click', () => {
      const panels = document.querySelectorAll('.artifact-details');
      const isVisible = btnToggleInfo.textContent.includes('HIDE'); // Simple check
      const newState = !isVisible;
      
      panels.forEach(p => p.style.opacity = newState ? '1' : '0');
      btnToggleInfo.textContent = newState ? 'HIDE INFO' : 'SHOW INFO';

      // Resize trigger
      setTimeout(() => {
        if (viewers.main) viewers.main.onResize();
        if (viewers.compare) viewers.compare.onResize();
      }, 300);
    });
  }

  // About Modal
  setupAboutModal();

  // Easter Egg
  const btnEgg = document.getElementById('btn-easter-egg');
  if (btnEgg) {
    btnEgg.addEventListener('click', () => {
      if (viewers.main) {
        const isActive = viewers.main.toggleEasterEgg();
        btnEgg.classList.toggle('active', isActive);
        showToast(isActive ? "Lightcycle Arena: ONLINE" : "Lightcycle Arena: OFFLINE", !isActive);
      }
    });
  }

  // Pulse
  const btnPulse = document.getElementById('btn-toggle-pulse');
  if (btnPulse) {
    btnPulse.addEventListener('click', () => {
      const isActive = btnPulse.classList.toggle('active');
      btnPulse.textContent = isActive ? "FLOW: ON" : "FLOW: OFF";
      if (viewers.main) viewers.main.setPulse(isActive);
      if (viewers.compare && viewers.compare.setPulse) viewers.compare.setPulse(isActive);
    });
  }

  // File Upload
  const fileInput = document.getElementById('file-upload');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      
      setActiveSlotCallback('main'); // Force Main
      
      viewers.main.loadCrystal(url).then(stats => {
          // Manually update UI via Panels helper or direct
          const ui = uiElements.main;
          if (ui.superTitle) ui.superTitle.textContent = "CUSTOM UPLOAD";
          ui.title.textContent = file.name.toUpperCase().replace('.PLY', '');
          ui.type.textContent = "USER DATA";
          ui.nodes.textContent = stats.nodes.toLocaleString();
          ui.links.textContent = stats.links.toLocaleString();
          ui.desc.innerHTML = "PREVISUALIZATION MODE<br><br>Loaded local artifact: " + file.name;
          
          document.getElementById('about-modal')?.classList.add('hidden');
      }).catch(err => {
          alert("Failed to load PLY: " + err);
      });
    });
  }

  // Mobile Menu
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  if (btnMobileMenu) {
    btnMobileMenu.addEventListener('click', () => {
      document.querySelector('.gallery-nav').classList.toggle('active');
    });
  }

  // Compare Toggle
  if (toggleCompare) {
      toggleCompare.addEventListener('change', (e) => {
        const isCompare = e.target.checked;
        if (isCompare) {
            viewCompare.classList.remove('hidden');
            viewerContainer.classList.add('split');
            panelB.classList.remove('hidden');
            setActiveSlotCallback('compare');
            
            setTimeout(() => {
                viewers.main.onResize();
                viewers.compare.onResize();
            }, 550);
        } else {
            viewCompare.classList.add('hidden');
            viewerContainer.classList.remove('split');
            panelB.classList.add('hidden');
            setActiveSlotCallback('main');
            
            setTimeout(() => {
                viewers.main.onResize();
            }, 550);
        }
      });
  }
}

function setupAboutModal() {
  const modal = document.getElementById('about-modal');
  const btnOpen = document.getElementById('btn-about');
  const btnClose = document.getElementById('btn-close-modal'); // ID changed in some versions? usually 'btn-close-about' or 'btn-close-modal'
  // logic in ui.js used 'btn-close-modal' (line 441) and 'btn-close-about' (line 584). 
  // Wait, ui.js had TWO places for this? 
  // Line 441: const btnCloseModal = document.getElementById('btn-close-modal');
  // Line 584: const btnClose = document.getElementById('btn-close-about');
  // I'll support both IDs to be safe.
  
  const closeBtns = [document.getElementById('btn-close-modal'), document.getElementById('btn-close-about')];

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtns.forEach(btn => {
        if(btn) btn.addEventListener('click', () => modal.classList.add('hidden'));
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
}
