import { showToast, setActivePanelStyle, uiElements, handleLoadCrystal } from './Panels.js';

export function setupControls(context) {
  const { viewers, activeSlotGetter, setActiveSlotCallback } = context;

  const replaceWithClone = (el) => {
    if (!el) return null;
    const newEl = el.cloneNode(true);
    if (el.parentNode) el.parentNode.replaceChild(newEl, el);
    return newEl;
  };

  const btnSpin = replaceWithClone(document.getElementById('btn-spin'));
  const btnReset = replaceWithClone(document.getElementById('btn-reset'));
  const btnToggleInfo = replaceWithClone(document.getElementById('btn-toggle-info'));
  const toggleCompare = document.getElementById('compare-toggle');
  const viewCompare = document.getElementById('view-compare');
  const viewerContainer = document.getElementById('viewer-container');
  const panelB = document.getElementById('panel-b');

  // Helper to apply to active or both
  const applyToViewers = (callback) => {
    if (viewers.main) callback(viewers.main);
    if (viewers.compare) callback(viewers.compare);
  };

  // --- ADVANCED SLIDERS ---
  const bindSlider = (id, callback) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        applyToViewers(v => callback(v, val));
      });
    }
  };

  // Movement
  bindSlider('pan-speed', (v, val) => v.setPanSpeed && v.setPanSpeed(val));
  bindSlider('rot-speed', (v, val) => v.setRotSpeed && v.setRotSpeed(val));
  bindSlider('view-height', (v, val) => v.setManualHeight && v.setManualHeight(val));

  const panMin = document.getElementById('pan-min');
  const panMax = document.getElementById('pan-max');
  if (panMin && panMax) {
    const updateLimits = () => {
      const min = parseFloat(panMin.value);
      const max = parseFloat(panMax.value);
      applyToViewers(v => {
        if (v.setPanMin) v.setPanMin(min);
        if (v.setPanMax) v.setPanMax(max);
      });
    };
    panMin.addEventListener('change', updateLimits);
    panMax.addEventListener('change', updateLimits);
  }

  // Auto Pan Toggle
  const btnPan = document.getElementById('btn-pan');
  if (btnPan) {
    btnPan.addEventListener('click', (e) => {
      const isActive = e.target.classList.toggle('active');
      applyToViewers(v => v.toggleAutoPan && v.toggleAutoPan(isActive));
    });
  }

  // Auto FPS Governor Toggle
  const autoFpsToggle = document.getElementById('auto-fps-toggle');
  if (autoFpsToggle && context.governor) {
    autoFpsToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        context.governor.start();
        showToast("FPS GOVERNOR: ENGAGED");
      } else {
        context.governor.stop();
        showToast("FPS GOVERNOR: MANUAL OVERRIDE");
      }
    });
  }

  // Visuals
  bindSlider('node-size', (v, val) => v.setBaseSize && v.setBaseSize(val));
  bindSlider('lfo-amt', (v, val) => v.setLFOAmount && v.setLFOAmount(val)); // Needs logic in Viewer
  bindSlider('xor-density', (v, val) => v.setXorDensity && v.setXorDensity(val));
  bindSlider('line-dist', (v, val) => v.setLineDist && v.setLineDist(val));
  bindSlider('line-density', (v, val) => v.setLineDensity && v.setLineDensity(val));
  bindSlider('node-density', (v, val) => v.setNodeDensity && v.setNodeDensity(val));
  bindSlider('thinning', (v, val) => v.setThinning && v.setThinning(val));


  // --- ACCORDION LOGIC ---
  const accordions = document.querySelectorAll('.accordion-toggle');
  accordions.forEach(acc => {
    acc.addEventListener('click', () => {
      acc.classList.toggle('active');
      const panel = acc.nextElementSibling;
      if (panel.style.display === 'block') {
        panel.style.display = 'none';
      } else {
        panel.style.display = 'block';
      }
    });
  });

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.control-group').forEach(g => g.classList.add('hidden'));

      // Activate this
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('active'); // ensure flex/block
      }
    });
  });


  // --- STANDARD CONTROLS ---

  // Shared View Controls
  if (btnReset) btnReset.addEventListener('click', () => {
    const slot = activeSlotGetter();
    if (slot === 'main' && viewers.main) viewers.main.resetView();
    else if (viewers.compare) viewers.compare.resetView();
  });

  if (btnSpin) btnSpin.addEventListener('click', (e) => {
    e.target.blur(); // Remove focus

    // Toggle class
    const wasActive = e.target.classList.contains('active');
    const newState = !wasActive;

    if (newState) e.target.classList.add('active');
    else e.target.classList.remove('active');

    console.log(`[Controls] Spin Clicked. Was: ${wasActive}, New: ${newState}`);

    const slot = activeSlotGetter();

    // Explicitly set BOTH viewers if possible, or just active?
    // Let's stick to logic: Shared controls usually affect active, but for "Auto" stuff maybe both?
    // The previous code only affected active slot. Let's stick to that but be robust.

    if (slot === 'main' && viewers.main) {
      viewers.main.setAutoRotate(newState);
      console.log("[Controls] Main AutoRotate Set To:", newState);
    } else if (viewers.compare && viewers.compare) {
      viewers.compare.setAutoRotate(newState);
    }
  });

  // Info Toggle
  if (btnToggleInfo) {
    btnToggleInfo.addEventListener('click', () => {
      const panels = document.querySelectorAll('.artifact-details');
      const isVisible = btnToggleInfo.textContent.includes('HIDE');
      const newState = !isVisible;
      
      panels.forEach(p => p.style.opacity = newState ? '1' : '0');
      btnToggleInfo.textContent = newState ? 'HIDE INFO' : 'SHOW INFO';

      setTimeout(() => {
        if (viewers.main) viewers.main.onResize();
        if (viewers.compare) viewers.compare.onResize();
      }, 300);
    });

    // Mobile Default: Hide Info
    if (window.innerWidth < 900) {
      // Trigger it to hide
      btnToggleInfo.click();
    }
  }

  // About Modal
  setupAboutModal();


  // Mobile Settings Menu
  const btnMobileSettings = document.getElementById('btn-mobile-settings');
  const mobileDropdown = document.getElementById('mobile-dropdown');

  if (btnMobileSettings && mobileDropdown) {
    btnMobileSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileDropdown.classList.toggle('hidden');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      // Check if click is inside dropdown OR inside the toggle button
      if (!mobileDropdown.contains(e.target) && !btnMobileSettings.contains(e.target)) {
        mobileDropdown.classList.add('hidden');
      }
    });

    // Wire up Dropdown Items
    const btnMobAbout = document.getElementById('mob-btn-about');
    const btnMobInfo = document.getElementById('mob-btn-info');
    const btnMobEgg = document.getElementById('mob-btn-egg');

    if (btnMobAbout) btnMobAbout.onclick = () => document.getElementById('btn-about').click();
    if (btnMobInfo) btnMobInfo.onclick = () => document.getElementById('btn-toggle-info').click();
    if (btnMobEgg) btnMobEgg.onclick = () => document.getElementById('btn-easter-egg').click();
  }

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
      applyToViewers(v => v.setPulse && v.setPulse(isActive));
    });
  }

  // File Upload
  const fileInput = document.getElementById('file-upload');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      
      setActiveSlotCallback('main'); 
      
      viewers.main.loadCrystal(url).then(stats => {
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
  // --- Advanced Defaults Reset ---
  const btnResetAdv = document.getElementById('btn-reset-advanced');
  const resetAdvancedDefaults = () => {
    // Defaults matching index.html
    const defaults = {
      'pan-speed': 0.5,
      'pan-min': -5,
      'pan-max': 10,
      'view-height': 20,
      'rot-speed': 2.0,
      'node-size': 0.15,
      'lfo-amt': 0.5,
      'xor-density': 0.0,
      'line-dist': 200,
      'line-density': 1.0,
      'node-density': 1.0,
      'thinning': 0.0,
      'auto-fps-toggle': true
    };

    Object.entries(defaults).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = val;
          el.dispatchEvent(new Event('change'));
        } else {
          el.value = val;
          el.dispatchEvent(new Event('input'));
        }
      }
    });

    if (btnResetAdv) {
      btnResetAdv.innerText = "RESET COMPLETE";
      setTimeout(() => {
        if (btnResetAdv) btnResetAdv.innerText = "RESET DEFAULTS";
      }, 1000);
    }

    // Reset Camera Position too
    applyToViewers(v => v.resetView && v.resetView());
  };

  if (btnResetAdv) {
    btnResetAdv.addEventListener('click', resetAdvancedDefaults);
  }
}

function setupAboutModal() {
  const modal = document.getElementById('about-modal');
  const btnOpen = document.getElementById('btn-about');
  const btnClose = document.getElementById('btn-close-modal');
  const btnClose2 = document.getElementById('btn-close-about');
  
  const closeBtns = [btnClose, btnClose2].filter(b => !!b);

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => modal.classList.add('hidden'));
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
}

