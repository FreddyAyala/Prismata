import { CrystalViewer } from './main.js';

// DOM Elements
const navList = document.getElementById('model-list');
const loader = document.getElementById('loader');
const toggleCompare = document.getElementById('compare-toggle');
const viewerContainer = document.getElementById('viewer-container');
const viewCompare = document.getElementById('view-compare');

// Panels
const panelA = document.getElementById('panel-a');
const panelB = document.getElementById('panel-b');

const uiElements = {
  main: {
    superTitle: document.getElementById('model-name-a'),
    title: document.getElementById('crystal-title-a'),
    type: document.getElementById('crystal-type-a'),
    desc: document.getElementById('crystal-desc-a'),
    nodes: document.getElementById('meta-nodes-a'),
    links: document.getElementById('meta-links-a'),
  },
  compare: {
    superTitle: document.getElementById('model-name-b'),
    title: document.getElementById('crystal-title-b'),
    type: document.getElementById('crystal-type-b'),
    desc: document.getElementById('crystal-desc-b'),
    nodes: document.getElementById('meta-nodes-b'),
    links: document.getElementById('meta-links-b'),
  }
};

// State
// State
let isCompareMode = false;
let activeSlot = 'main'; // 'main' or 'compare'
let mainViewer = null;
let compareViewer = null;
let infoVisible = true;
let autoFPSEnabled = true;
window.targetFPS = 24;
let currentPalette = 'classic';
let isInverted = true;

// Recording State
let isRecording = false;
let recordingBuffer = [];
let recordingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Init Viewers
  mainViewer = new CrystalViewer('view-main');
  compareViewer = new CrystalViewer('view-compare');

  // Ghost Fader Logic
  const ghost = document.getElementById('size-ghost');
  const sizeSlider = document.getElementById('point-size-slider');

  if (ghost && sizeSlider) {
    mainViewer.onUpdateUI = (currentSize) => {
      const min = parseFloat(sizeSlider.min);
      const max = parseFloat(sizeSlider.max);

      // Ensure max is correct (it might change in DOM)
      // If necessary, we can hardcode 0.1 for now if DOM didn't update before this calls 
      // but user interaction drives this so DOM is usually ready. 

      const percent = ((currentSize - min) / (max - min)) * 100;

      // Clamp visuals
      let p = Math.max(0, Math.min(100, percent));
      ghost.style.left = `${p}%`;

      // Show/Hide based on difference from base
      if (Math.abs(currentSize - mainViewer.baseSize) > 0.0001) {
        ghost.classList.remove('hidden');
      } else {
        ghost.classList.add('hidden');
      }
    };
  }

  // 2. Load Gallery
  await loadGallery();
  setupControls();

  // 3. Setup Search & Filters
  setupSearch();

  // 4. Setup Slot Selection
  panelA.addEventListener('click', () => setActiveSlot('main'));
  panelB.addEventListener('click', () => setActiveSlot('compare'));

  // Initial State
  setActiveSlot('main');
});

// Filter State
const filterState = {
  query: '',
  tag: 'ALL'
};

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    filterState.query = e.target.value.toLowerCase();
    applyFilters();
  });
}

function setupTags(models) {
  const container = document.getElementById('filter-tags');
  if (!container) return;

  container.innerHTML = ''; // clear
  // Force specific order
  const types = new Set(['ALL', 'LLM']);
  models.forEach(m => types.add(m.type));

  types.forEach(type => {
    const btn = document.createElement('div');
    btn.className = 'filter-tag';
    if (type === 'ALL') btn.classList.add('active');
    btn.textContent = type;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      filterState.tag = type;
      applyFilters();
    });

    container.appendChild(btn);
  });
}

function applyFilters() {
  const groups = document.querySelectorAll('.model-group');
  const { query, tag } = filterState;

  groups.forEach(group => {
    const groupTitle = group.querySelector('.model-title').textContent.toLowerCase();
    const items = group.querySelectorAll('.crystal-item');
    let hasVisibleItem = false;

    items.forEach(item => {
      const name = item.dataset.name.toLowerCase();
      const desc = item.dataset.desc.toLowerCase();
      const type = item.dataset.type;

      const matchesQuery = groupTitle.includes(query) || name.includes(query) || desc.includes(query);
      let matchesTag = (tag === 'ALL') || (type === tag);
      if (tag === 'LLM') {
        const llmTypes = ['Encoder', 'Decoder', 'Enc-Dec', 'Dense Decoder', 'CoT Decoder', 'MoE', 'Mobile'];
        matchesTag = llmTypes.includes(type);
      }

      if (matchesQuery && matchesTag) {
        item.style.display = 'block';
        hasVisibleItem = true;
      } else {
        item.style.display = 'none';
      }
    });

    if (hasVisibleItem) {
      group.style.display = 'block';
      if (query.length > 0 || tag !== 'ALL') group.classList.add('active');
      else group.classList.remove('active');
    } else {
      group.style.display = 'none';
    }

    if (query.length === 0 && tag === 'ALL') {
      group.style.display = 'block';
      group.classList.remove('active');
      if (group === groups[0]) group.classList.add('active');
    }
  });
}

function setActiveSlot(slot) {
  if (slot === 'compare' && !isCompareMode) return;
  activeSlot = slot;

  if (slot === 'main') {
    panelA.style.borderColor = '#00f3ff';
    panelA.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.2)';
    panelB.style.borderColor = 'rgba(0, 243, 255, 0.2)';
    panelB.style.boxShadow = 'none';
  } else {
    panelB.style.borderColor = '#00f3ff';
    panelB.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.2)';
    panelA.style.borderColor = 'rgba(0, 243, 255, 0.2)';
    panelA.style.boxShadow = 'none';
  }
}

async function loadGallery() {
  try {
    // Load Manifest
    const res = await fetch('./crystals/manifest.json');
    let models = await res.json();

    // Sort by Year (Descending: Recent -> Oldest)
    models.sort((a, b) => b.year - a.year);

    // Setup Tags based on loaded models
    setupTags(models);

    models.forEach((model, index) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'model-group';
      // Open grouping for recent models by default? Or just first?
      if (index === 0) groupDiv.classList.add('active');

      const groupTitle = document.createElement('div');
      groupTitle.className = 'model-title';
      // Year | Name
      groupTitle.innerHTML = `<span style="opacity:0.6; font-family:monospace; margin-right:8px;">${model.year}</span> ${model.name}`;

      groupTitle.addEventListener('click', () => {
        groupDiv.classList.toggle('active');
      });
      groupDiv.appendChild(groupTitle);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'group-content';

      model.crystals.forEach(crystal => {
        const item = document.createElement('div');
        item.className = 'crystal-item';
        item.dataset.url = `./${crystal.file}`;
        item.dataset.name = crystal.name;
        item.dataset.desc = crystal.desc;
        item.dataset.type = model.type;
        item.dataset.year = model.year;
        item.dataset.modelName = model.name; // Pass Model Name
        item.dataset.modelDesc = model.desc;
        item.dataset.modelId = model.id;

        item.innerHTML = `
                    <span class="item-name">${crystal.name}</span>
                    <span class="item-desc">${crystal.desc.substring(0, 35)}...</span>
                `;

        item.addEventListener('click', () => {
          document.querySelectorAll('.crystal-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          handleLoadCrystal(item.dataset, activeSlot);
          // Close mobile menu if open
          document.querySelector('.gallery-nav').classList.remove('active');
        });

        contentDiv.appendChild(item);
      });

      groupDiv.appendChild(contentDiv);
      navList.appendChild(groupDiv);
    });

    // Auto-select first item
    setTimeout(() => {
      const firstItem = navList.querySelector('.crystal-item');
      if (firstItem) firstItem.click();
    }, 100);

  } catch (err) {
    console.error("Failed to load manifest:", err);
    navList.innerHTML = `<div style="color:red; padding:1rem;">ERROR CONNECTING TO ARCHIVE<br>${err.message}</div>`;
  }
}

async function handleLoadCrystal(data, slot) {
  loader.classList.remove('hidden');

  const ui = slot === 'main' ? uiElements.main : uiElements.compare;
  const viewer = slot === 'main' ? mainViewer : compareViewer;

  if (ui.superTitle) ui.superTitle.textContent = data.modelName || 'UNKNOWN CLASS';
  ui.title.textContent = data.name;
  ui.type.textContent = data.type;

  try {
    const stats = await viewer.loadCrystal(data.url);

    ui.nodes.textContent = stats.nodes.toLocaleString();
    ui.links.textContent = stats.links.toLocaleString();

    let infoText = "";
    try {
      const res = await fetch(`./crystals/${data.modelId}/INFO.md`);
      if (res.ok) {
        const text = await res.text();
        // Vite fallback protection
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          infoText = data.desc || "No description available.";
        } else {
          infoText = text;
        }
      }
      else infoText = data.desc;
    } catch (e) {
      infoText = data.desc;
    }

    ui.desc.innerHTML = `
            <div class="markdown-content">
                ${parseMarkdown(infoText)}
            </div>
            <br>
            <div style="font-size:0.7em; opacity:0.6;">SOURCE: ${data.url.split('/').pop()}</div>
        `;

  } catch (err) {
    ui.title.textContent = "LOAD ERROR";
    ui.desc.textContent = "Corrupted data.";
  } finally {
    loader.classList.add('hidden');
  }
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = text;

  // Normalize newlines
  html = html.replace(/\r\n/g, '\n');
  html = html.replace(/\\n/g, '\n');

  // 1. Structural
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#fff;">$1</strong>');
  html = html.replace(/^#\s+(.*)$/gm, '');

  // 2. Headers (Global replacement because of possible leading whitespace issues or newlines)
  html = html.replace(/^##\s+(.*)$/gm, '<h4 style="color:#00f3ff; margin-top:15px; margin-bottom:5px; text-transform:uppercase;">$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h5 style="color:#fff; margin-top:10px; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:2px;">$1</h5>');

  // 3. Newlines LAST
  html = html.replace(/\n/gm, '<br>');

  // 4. Cleanup
  html = html.replace(/<\/h4><br>/g, '</h4>');
  html = html.replace(/<\/h5><br>/g, '</h5>');

  return html;
}

function setupControls() {
  const btnSpin = document.getElementById('btn-spin');
  const btnReset = document.getElementById('btn-reset');
  const btnToggleInfo = document.getElementById('btn-toggle-info');
  const btnPan = document.getElementById('btn-pan');


  if (btnPan) {
    btnPan.addEventListener('click', () => {
      const isActive = mainViewer.toggleAutoPan();
      btnPan.classList.toggle('active', isActive);
      // Removed exclusivity logic
    });
  }

  // Palette Menu Logic
  const paletteTrigger = document.getElementById('palette-trigger');
  const paletteMenu = document.getElementById('palette-menu');
  const paletteOptions = document.querySelectorAll('.palette-option');

  if (paletteTrigger && paletteMenu) {
    paletteTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      paletteMenu.classList.toggle('hidden');
    });

    // Add click listeners to legend labels
    const legendLabels = document.querySelectorAll('.legend-label');
    legendLabels.forEach(label => {
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        // Trigger click on palette trigger to open menu
        paletteTrigger.click();
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      paletteMenu.classList.add('hidden');
    });

    paletteOptions.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const paletteName = opt.dataset.palette;
        currentPalette = paletteName;

        // Update both viewers
        if (mainViewer) mainViewer.setPalette(paletteName);
        if (compareViewer) compareViewer.setPalette(paletteName);

        // Update UI gradient bar
        paletteTrigger.className = `gradient-bar ${paletteName}`;
        paletteMenu.classList.add('hidden');
      });
    });

    // Initial load sync
    paletteTrigger.className = `gradient-bar ${currentPalette}`;
  }

  // Hook up Spin to disable Pan - REMOVED for independent control
  // if (btnSpin) ... removed

  if (btnSpin) {
    btnSpin.addEventListener('click', () => {
      const isActive = btnSpin.classList.toggle('active');
      mainViewer.setAutoRotate(isActive);
      compareViewer.setAutoRotate(isActive);
      btnSpin.textContent = isActive ? "AUTO-ROTATE: ON" : "AUTO-ROTATE: OFF";
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      mainViewer.resetView();
      compareViewer.resetView();
    });
  }

  if (btnToggleInfo) {
    document.getElementById('btn-toggle-info').addEventListener('click', () => {
      const panels = document.querySelectorAll('.artifact-details');
      // Assuming infoVisible is defined globally or in a scope accessible here
      // If not, this would need to be initialized, e.g., `let infoVisible = true;`
      // For now, faithfully applying the change as provided.
      infoVisible = !infoVisible;
      panels.forEach(p => p.style.opacity = infoVisible ? '1' : '0');
      document.getElementById('btn-toggle-info').textContent = infoVisible ? 'HIDE INFO' : 'SHOW INFO';

      setTimeout(() => {
        if (mainViewer) mainViewer.onResize();
        if (compareViewer) compareViewer.onResize();
      }, 300);
    });

    // Mobile Default: Hide Info
    if (window.innerWidth < 900) {
      document.querySelector('.ui-layer').classList.add('no-details');
      btnToggleInfo.textContent = "SHOW INFO";
    }
  }

  // About Modal Logic
  const btnAbout = document.getElementById('btn-about');
  const modal = document.getElementById('about-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');

  if (btnAbout && modal) {
    btnAbout.addEventListener('click', () => modal.classList.remove('hidden'));
    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  // Pan Speed Slider
  const panSpeedSlider = document.getElementById('pan-speed');
  if (panSpeedSlider) {
    panSpeedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      if (mainViewer) mainViewer.setPanSpeed(speed);
      if (compareViewer) compareViewer.setPanSpeed(speed);
    });
  }

  // Rotate Speed Slider
  const rotSpeedSlider = document.getElementById('rot-speed');
  if (rotSpeedSlider) {
    rotSpeedSlider.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      if (mainViewer) mainViewer.setRotSpeed(speed);
      if (compareViewer) compareViewer.setRotSpeed(speed);
    });
  }

  // Pan Limits Sliders
  // Dual Range Slider Logic
  const rangeMin = document.getElementById('pan-limit-min');
  const rangeMax = document.getElementById('pan-limit-max');
  const rangeTrack = document.getElementById('pan-track');

  function updateDualSlider() {
    if (!rangeMin || !rangeMax || !rangeTrack) return;

    let minVal = parseFloat(rangeMin.value);
    let maxVal = parseFloat(rangeMax.value);

    // Prevent crossover
    if (minVal > maxVal - 1) {
      const temp = minVal;
      minVal = maxVal - 1;
      rangeMin.value = minVal;
    }

    const min = parseFloat(rangeMin.min);
    const max = parseFloat(rangeMin.max);

    // Update visual track
    const percentMin = ((minVal - min) / (max - min)) * 100;
    const percentMax = ((maxVal - min) / (max - min)) * 100;

    rangeTrack.style.left = percentMin + "%";
    rangeTrack.style.width = (percentMax - percentMin) + "%";

    // Update Viewers
    if (mainViewer) {
      mainViewer.setPanMin(minVal);
      mainViewer.setPanMax(maxVal);
    }
    if (compareViewer) {
      compareViewer.setPanMin(minVal);
      compareViewer.setPanMax(maxVal);
    }
  }

  if (rangeMin && rangeMax) {
    rangeMin.addEventListener('input', updateDualSlider);
    rangeMax.addEventListener('input', updateDualSlider);
    // Init
    updateDualSlider();
  }

  // Movement & PERF Section Toggles (Tabs)
  const btnMovement = document.getElementById('btn-movement');
  const btnPerf = document.getElementById('btn-perf');
  const movementSection = document.getElementById('movement-controls');
  const perfSection = document.getElementById('perf-controls');

  if (btnMovement && btnPerf && movementSection && perfSection) {
    btnMovement.addEventListener('click', () => {
      const isOpening = !btnMovement.classList.contains('open');

      // Toggle Movement
      btnMovement.classList.toggle('open', isOpening);
      movementSection.classList.toggle('open', isOpening);

      // Close Perf
      btnPerf.classList.remove('open');
      perfSection.classList.remove('open');
    });

    btnPerf.addEventListener('click', () => {
      const isOpening = !btnPerf.classList.contains('open');

      // Toggle Perf
      btnPerf.classList.toggle('open', isOpening);
      perfSection.classList.toggle('open', isOpening);

      // Close Movement
      btnMovement.classList.remove('open');
      movementSection.classList.remove('open');
    });
  }

  // Auto FPS Toggle (Relocated to bottom of Perf)
  if (perfSection) {
    const autoFPSToggle = document.createElement('div');
    autoFPSToggle.className = 'control-group';
    autoFPSToggle.innerHTML = `
      <label for="auto-fps-checkbox" class="control-label">Auto FPS</label>
      <input type="checkbox" id="auto-fps-checkbox" checked>
    `;
    perfSection.appendChild(autoFPSToggle);

    const checkbox = document.getElementById('auto-fps-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        autoFPSEnabled = e.target.checked;
      });
    }

    // Target FPS Slider
    const targetFPSSlider = document.createElement('div');
    targetFPSSlider.className = 'control-group';
    targetFPSSlider.innerHTML = `
      <label for="target-fps-slider" class="control-label">Target FPS <span id="target-fps-display">24</span></label>
      <input type="range" id="target-fps-slider" min="10" max="120" value="24" step="1">
    `;
    perfSection.appendChild(targetFPSSlider);

    const targetFPSSliderEl = document.getElementById('target-fps-slider');
    if (targetFPSSliderEl) {
      targetFPSSliderEl.addEventListener('input', (e) => {
        window.targetFPS = parseInt(e.target.value);
        document.getElementById('target-fps-display').textContent = e.target.value;
      });
    }

    // copySettingsBtn
    const copySettingsBtn = document.createElement('button');
    copySettingsBtn.className = 'minimal-btn';
    copySettingsBtn.textContent = 'COPY SETTINGS';
    copySettingsBtn.style.marginTop = '10px';
    copySettingsBtn.addEventListener('click', () => {
      const settings = {
        panSpeed: parseFloat(document.getElementById('pan-speed').value),
        rotSpeed: parseFloat(document.getElementById('rot-speed').value),
        panMin: parseFloat(document.getElementById('pan-limit-min').value),
        panMax: parseFloat(document.getElementById('pan-limit-max').value),
        pointSize: parseFloat(document.getElementById('point-size-slider').value),
        lfoAmount: parseFloat(document.getElementById('lfo-slider').value),
        lfoSpeed: parseFloat(document.getElementById('lfo-speed').value),
        lineDist: parseFloat(document.getElementById('line-dist-slider').value),
        nodeDist: parseFloat(document.getElementById('node-dist-slider').value),
        lineDensity: parseFloat(document.getElementById('line-density-slider').value),
        nodeDensity: parseFloat(document.getElementById('node-density-slider').value),
        summarizeThin: parseFloat(document.getElementById('summarize-thin').value),
        viewHeight: parseFloat(document.getElementById('view-height').value),
        xorDensity: parseFloat(document.getElementById('xor-density-slider').value),
        nodeOpacity: parseFloat(document.getElementById('node-opacity-slider').value),
        pulse: document.getElementById('btn-toggle-pulse').classList.contains('active'),
        autoPan: document.getElementById('btn-pan').classList.contains('active'),
        autoRotate: document.getElementById('btn-spin').classList.contains('active'),
        targetFPS: targetFPS,
        autoFPS: autoFPSEnabled,
        palette: currentPalette,
        inverted: isInverted
      };
      const settingsJSON = JSON.stringify(settings, null, 2);
      navigator.clipboard.writeText(settingsJSON).then(() => {
        showToast('Settings copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy settings:', err);
        showToast('Failed to copy settings.', true);
      });
    });
    perfSection.appendChild(copySettingsBtn);
  }
}

// Record Attract Logic
const btnRecord = document.getElementById('btn-record');
if (btnRecord) {
  btnRecord.addEventListener('click', () => {
    if (!isRecording) {
      // Start Recording
      isRecording = true;
      recordingBuffer = [];
      btnRecord.textContent = "STOP RECORDING";
      btnRecord.classList.add('active');
      showToast("Recording camera path...");

      recordingInterval = setInterval(() => {
        if (mainViewer && mainViewer.camera && mainViewer.controls) {
          recordingBuffer.push({
            pos: {
              x: parseFloat(mainViewer.camera.position.x.toFixed(3)),
              y: parseFloat(mainViewer.camera.position.y.toFixed(3)),
              z: parseFloat(mainViewer.camera.position.z.toFixed(3))
            },
            target: {
              x: parseFloat(mainViewer.controls.target.x.toFixed(3)),
              y: parseFloat(mainViewer.controls.target.y.toFixed(3)),
              z: parseFloat(mainViewer.controls.target.z.toFixed(3))
            }
          });
        }
      }, 50); // 20fps recording
    } else {
      // Stop Recording
      isRecording = false;
      clearInterval(recordingInterval);
      btnRecord.textContent = "RECORD ATTRACT";
      btnRecord.classList.remove('active');

      if (recordingBuffer.length > 0) {
        const data = JSON.stringify(recordingBuffer);
        navigator.clipboard.writeText(data).then(() => {
          showToast("Camera path copied to clipboard!");
        }).catch(err => {
          console.error("Failed to copy path:", err);
          showToast("Failed to copy path.", true);
        });
      }
    }
  });
}

// Easter Egg Toggle
const btnEgg = document.getElementById('btn-easter-egg');
if (btnEgg) {
  btnEgg.addEventListener('click', () => {
    if (mainViewer) {
      const isActive = mainViewer.toggleEasterEgg();
      btnEgg.classList.toggle('active', isActive);

      if (isActive) {
        showToast("Lightcycle Arena: ONLINE");
      } else {
        showToast("Lightcycle Arena: OFFLINE", true);
      }
    }
  });
}

// Pulse Toggle
const btnPulse = document.getElementById('btn-toggle-pulse');
if (btnPulse) {
  btnPulse.addEventListener('click', () => {
    const isActive = btnPulse.classList.toggle('active');
    btnPulse.textContent = isActive ? "FLOW: ON" : "FLOW: OFF";
    if (mainViewer) mainViewer.setPulse(isActive);
  });
}

// Point Size Slider
const pointSizeSlider = document.getElementById('point-size-slider');
if (pointSizeSlider) {
  pointSizeSlider.addEventListener('input', (e) => {
    const size = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setBaseSize(size);
    if (compareViewer) compareViewer.setBaseSize(size);
  });
}

// View Height Control
const heightSlider = document.getElementById('view-height');
if (heightSlider) {
  heightSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setManualHeight(val);
    if (compareViewer) compareViewer.setManualHeight(val);
  });
}

// LFO Slider
const lfoSlider = document.getElementById('lfo-slider');
if (lfoSlider) {
  lfoSlider.addEventListener('input', (e) => {
    const amount = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setLFOAmount(amount);
    if (compareViewer) compareViewer.setLFOAmount(amount);
  });
}

// LFO Speed Slider
const lfoSpeedSlider = document.getElementById('lfo-speed');
if (lfoSpeedSlider) {
  lfoSpeedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setLFOSpeed(speed);
    if (compareViewer) compareViewer.setLFOSpeed(speed);
  });
}

// PERFORMANCE Property Sliders
const lineDistSlider = document.getElementById('line-dist-slider');
if (lineDistSlider) {
  lineDistSlider.addEventListener('input', (e) => {
    const dist = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setLineDist(dist);
    if (compareViewer) compareViewer.setLineDist(dist);
  });
}

const nodeDistSlider = document.getElementById('node-dist-slider');
if (nodeDistSlider) {
  nodeDistSlider.addEventListener('input', (e) => {
    const dist = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setNodeDist(dist);
    if (compareViewer) compareViewer.setNodeDist(dist);
  });
}

const lineDensitySlider = document.getElementById('line-density-slider');
if (lineDensitySlider) {
  lineDensitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setLineDensity(val);
    if (compareViewer) compareViewer.setLineDensity(val);
  });
}

const nodeDensitySlider = document.getElementById('node-density-slider');
if (nodeDensitySlider) {
  nodeDensitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setNodeDensity(val);
    if (compareViewer) compareViewer.setNodeDensity(val);
  });
}

const summarizeThinSlider = document.getElementById('summarize-thin');
if (summarizeThinSlider) {
  summarizeThinSlider.addEventListener('input', (e) => {
    const intensity = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setThinning(intensity);
    if (compareViewer) compareViewer.setThinning(intensity);
  });
}

const xorDensitySlider = document.getElementById('xor-density-slider');
if (xorDensitySlider) {
  xorDensitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setXorDensity(val);
    if (compareViewer) compareViewer.setXorDensity(val);
  });
}

// New Visual Controls
const colorInflSlider = document.getElementById('color-infl-slider');
if (colorInflSlider) {
  colorInflSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) / 100;
    if (mainViewer) mainViewer.setColorInfluence(val);
    if (compareViewer) compareViewer.setColorInfluence(val);
  });
}

const lineOpacitySlider = document.getElementById('line-opacity-slider');
if (lineOpacitySlider) {
  lineOpacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setLineOpacity(val);
    if (compareViewer) compareViewer.setLineOpacity(val);
  });
}

const nodeSaturSlider = document.getElementById('node-satur-slider');
if (nodeSaturSlider) {
  nodeSaturSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setNodeSaturation(val);
    if (compareViewer) compareViewer.setNodeSaturation(val);
  });
}

const nodeOpacitySlider = document.getElementById('node-opacity-slider');
if (nodeOpacitySlider) {
  nodeOpacitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (mainViewer) mainViewer.setNodeOpacity(val);
    if (compareViewer) compareViewer.setNodeOpacity(val);
  });
}

const btnNodeBlend = document.getElementById('btn-node-blend');
if (btnNodeBlend) {
  btnNodeBlend.addEventListener('click', () => {
    const isAdditive = btnNodeBlend.textContent === 'NORMAL';
    btnNodeBlend.textContent = isAdditive ? 'ADDITIVE' : 'NORMAL';
    const mode = isAdditive ? 'additive' : 'normal';
    if (mainViewer) mainViewer.setNodeBlending(mode);
    if (compareViewer) compareViewer.setNodeBlending(mode);
  });
}

const btnLineBlend = document.getElementById('btn-line-blend');
if (btnLineBlend) {
  btnLineBlend.addEventListener('click', () => {
    const isAdditive = btnLineBlend.textContent === 'NORMAL';
    btnLineBlend.textContent = isAdditive ? 'ADDITIVE' : 'NORMAL';
    const mode = isAdditive ? 'additive' : 'normal';
    if (mainViewer) mainViewer.setLineBlending(mode);
    if (compareViewer) compareViewer.setLineBlending(mode);
  });
}

const btnInvertInfluence = document.getElementById('btn-invert-influence');
if (btnInvertInfluence) {
  // Set initial state
  btnInvertInfluence.textContent = isInverted ? 'INVERTED (COMPLEMENTARY)' : 'DIRECT INFLUENCE';
  if (mainViewer) mainViewer.setInvertInfluence(isInverted);
  if (compareViewer) compareViewer.setInvertInfluence(isInverted);

  btnInvertInfluence.addEventListener('click', () => {
    isInverted = !isInverted;
    btnInvertInfluence.textContent = isInverted ? 'INVERTED (COMPLEMENTARY)' : 'DIRECT INFLUENCE';
    if (mainViewer) mainViewer.setInvertInfluence(isInverted);
    if (compareViewer) compareViewer.setInvertInfluence(isInverted);
  });
}

// File Upload Logic
const fileInput = document.getElementById('file-upload');
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    console.log("Loading custom file:", url);

    // Force Main View logic
    setActiveSlot('main');

    mainViewer.loadCrystal(url).then(stats => {
      // Update UI
      if (uiElements.main.superTitle) uiElements.main.superTitle.textContent = "CUSTOM UPLOAD";
      uiElements.main.title.textContent = file.name.toUpperCase().replace('.PLY', '');
      uiElements.main.type.textContent = "USER DATA";
      uiElements.main.nodes.textContent = stats.nodes.toLocaleString();
      uiElements.main.links.textContent = stats.links.toLocaleString();
      uiElements.main.desc.innerHTML = "PREVISUALIZATION MODE<br><br>Loaded local artifact: " + file.name;

      // Close modal
      if (modal) modal.classList.add('hidden');
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



toggleCompare.addEventListener('change', (e) => {
  isCompareMode = e.target.checked;
  if (isCompareMode) {
    viewCompare.classList.remove('hidden');
    viewerContainer.classList.add('split');
    panelB.classList.remove('hidden');
    setActiveSlot('compare');
    setTimeout(() => {
      mainViewer.onResize();
      compareViewer.onResize();
    }, 550);
  } else {
    viewCompare.classList.add('hidden');
    viewerContainer.classList.remove('split');
    panelB.classList.add('hidden');
    setActiveSlot('main');
    setTimeout(() => {
      mainViewer.onResize();
    }, 550);
  }
});

// Toast Helper
function showToast(msg, isAlert = false) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.classList.remove('alert');
  if (isAlert) toast.classList.add('alert');

  // Force reflow
  void toast.offsetWidth;

  toast.classList.add('show');

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// --- TIMELINE LOGIC ---

// Timeline Elements
const timelineOverlay = document.getElementById('timeline-overlay');
const timelineTrack = document.getElementById('timeline-track');
const timelineYear = document.getElementById('timeline-year');
const timelineTitle = document.getElementById('timeline-title');
const timelineDesc = document.getElementById('timeline-desc');
const btnPrev2 = document.getElementById('btn-prev-model');
const btnNext2 = document.getElementById('btn-next-model');
const btnCloseTime = document.getElementById('btn-close-timeline');

let timelineModels = [];
let currentIndex = 0;

function setupTimelineMode(models) {
  // Sort Chronologically (Old -> New) for Timeline
  timelineModels = [...models].sort((a, b) => a.year - b.year);

  if (timelineTrack) {
    timelineTrack.innerHTML = '';

    timelineModels.forEach((model, index) => {
      // Only use the first crystal to represent the model
      // Skip if no crystals
      if (!model.crystals || model.crystals.length === 0) return;

      const crystal = model.crystals[0];

      const node = document.createElement('div');
      node.className = 'timeline-node';
      node.dataset.index = index;

      node.innerHTML = `
          <div class="node-dot"></div>
          <span class="node-year">${model.year}</span>
          <span class="node-label">${model.name}</span>
        `;

      node.addEventListener('click', () => {
        goToTimelineIndex(index);
      });

      timelineTrack.appendChild(node);
    });
  }

  // Nav Buttons
  if (btnPrev2) btnPrev2.addEventListener('click', () => {
    if (currentIndex > 0) goToTimelineIndex(currentIndex - 1);
  });

  if (btnNext2) btnNext2.addEventListener('click', () => {
    if (currentIndex < timelineModels.length - 1) goToTimelineIndex(currentIndex + 1);
  });

  if (btnCloseTime) btnCloseTime.addEventListener('click', () => {
    exitTimelineMode();
  });
}

function enterTimelineMode() {
  // 1. Show Overlay
  if (timelineOverlay) timelineOverlay.classList.remove('hidden');

  // 2. Hide Standard UI
  const nav = document.querySelector('.gallery-nav');
  const details = document.querySelector('.artifact-details');
  const headerMain = document.querySelector('.gallery-header');

  if (nav) { nav.style.opacity = '0'; nav.style.pointerEvents = 'none'; }
  if (details) details.style.opacity = '0';
  if (headerMain) headerMain.style.opacity = '0';

  // 3. Reset View
  if (typeof isCompareMode !== 'undefined' && isCompareMode) {
    // Force exit compare mode if we can access toggle
    const toggle = document.getElementById('compare-toggle');
    if (toggle) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
    }
  }

  // 4. Start at beginning (Perceptron)
  goToTimelineIndex(0);
}

function exitTimelineMode() {
  if (timelineOverlay) timelineOverlay.classList.add('hidden');

  // Restore UI
  const nav = document.querySelector('.gallery-nav');
  const details = document.querySelector('.artifact-details');
  const headerMain = document.querySelector('.gallery-header');

  if (nav) { nav.style.opacity = '1'; nav.style.pointerEvents = 'auto'; }
  if (details) details.style.opacity = '1';
  if (headerMain) headerMain.style.opacity = '1';

  // Reset Camera?
  if (mainViewer) mainViewer.resetView();
}

function goToTimelineIndex(index) {
  currentIndex = index;
  const model = timelineModels[index];
  if (!model) return;
  const crystal = model.crystals[0];

  // 1. Update Active Node UI
  document.querySelectorAll('.timeline-node').forEach(n => {
    n.classList.remove('active');
    if (parseInt(n.dataset.index) === index) {
      n.classList.add('active');
      n.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  });

  // 2. Update Info Text
  // Animate Out
  if (timelineTitle) timelineTitle.style.opacity = 0;
  if (timelineDesc) timelineDesc.style.opacity = 0;
  if (timelineYear) timelineYear.style.opacity = 0;

  setTimeout(() => {
    if (timelineYear) timelineYear.textContent = model.year;
    if (timelineTitle) timelineTitle.textContent = model.name;
    if (timelineDesc) timelineDesc.textContent = model.desc; // Use short desc

    // Animate In
    if (timelineTitle) timelineTitle.style.opacity = 1;
    if (timelineDesc) timelineDesc.style.opacity = 1;
    if (timelineYear) timelineYear.style.opacity = 1;
  }, 200);

  // 3. Load Crystal
  const data = {
    url: `./${crystal.file}`,
    name: crystal.name,
    type: model.type,
    modelName: model.name,
    desc: crystal.desc,
    modelId: model.id
  };

  if (mainViewer) {
    mainViewer.loadCrystal(data.url).then(() => {
      // Optional: Auto-rotate faster?
    }).catch(e => console.error(e));
  }
}

// Add Timeline Button to Header (Dynamically)
setTimeout(() => {
  const headerStatus = document.querySelector('.status-indicator');
  if (headerStatus) {
    const btnTimeline = document.createElement('button');
    btnTimeline.className = 'minimal-btn';
    btnTimeline.textContent = "TIMELINE VIEW";
    btnTimeline.style.border = "1px solid var(--color-accent)";
    btnTimeline.style.color = "var(--color-accent)";
    btnTimeline.style.fontWeight = "bold";
    btnTimeline.style.boxShadow = "0 0 10px rgba(255, 0, 85, 0.2)";

    btnTimeline.addEventListener('click', enterTimelineMode);


    headerStatus.insertBefore(btnTimeline, headerStatus.firstChild);
  }
}, 1000); // Wait for DOM

// Self-init timeline data independently to avoid scope issues
fetch('./crystals/manifest.json').then(r => r.json()).then(models => {
  setupTimelineMode(models);
});

// --- DYNAMIC PERFORMANCE GOVERNOR ---
let fpsStabilityCounter = 0;
let xorReductionDelay = 0;
window.addEventListener('fps-update', (e) => {
  const fps = e.detail.fps;
  const thinSlider = document.getElementById('summarize-thin');
  const lineDistSlider = document.getElementById('line-dist-slider');
  const nodeDistSlider = document.getElementById('node-dist-slider');
  const lineDensitySlider = document.getElementById('line-density-slider');
  const nodeDensitySlider = document.getElementById('node-density-slider');
  const xorDensitySlider = document.getElementById('xor-density-slider');

  if (!thinSlider || !lineDistSlider || !nodeDistSlider || !lineDensitySlider || !nodeDensitySlider || !xorDensitySlider) return;

  let currentThin = parseFloat(thinSlider.value);
  let currentLineDist = parseFloat(lineDistSlider.value);
  let currentNodeDist = parseFloat(nodeDistSlider.value);
  let currentLineDensity = parseFloat(lineDensitySlider.value);
  let currentNodeDensity = parseFloat(nodeDensitySlider.value);
  let currentXorDensity = parseFloat(xorDensitySlider.value);

  let nextThin = currentThin;
  let nextLineDist = currentLineDist;
  let nextNodeDist = currentNodeDist;
  let nextLineDensity = currentLineDensity;
  let nextNodeDensity = currentNodeDensity;
  let nextXorDensity = currentXorDensity;

  if (autoFPSEnabled) {
    if (fps < targetFPS && fps > 0) {
      // PERFORMANCE DROP: Tiered Optimization
      // 1. Reduce XOR visibility first, but keep at least 5%
      if (currentXorDensity > 5) {
        nextXorDensity = Math.max(5, currentXorDensity - 5);
        xorReductionDelay = 0;
      } else {
        xorReductionDelay++;
        if (xorReductionDelay > 5) {
          // 2. Increase Thinning before dropping density
          if (currentThin < 1.0) {
            nextThin = Math.min(1.0, currentThin + 0.1);
          }
          // 3. Reduce line/node density BEFORE distance clipping
          // Prioritize reducing line density over node density
          else if (currentLineDensity > 10 || currentNodeDensity > 30) {
            if (currentLineDensity > 10) {
              nextLineDensity = Math.max(10, currentLineDensity - 8);
            }
            if (currentNodeDensity > 30) {
              nextNodeDensity = Math.max(30, currentNodeDensity - 4);
            }
          } else {
            // 4. Last resort: reduce distance clipping much faster
            nextLineDist = Math.max(10, currentLineDist - 20);
            nextNodeDist = Math.max(10, currentNodeDist - 20);
          }
        }
      }
      fpsStabilityCounter = 0;
    } else if (fps >= targetFPS + 1) {
      fpsStabilityCounter++;
      if (fpsStabilityCounter > 4) {
        // RECOVERY: Node Density -> Distance -> Line Density -> Thinning -> XOR
        // Nodes are recovered first to maintain structure
        if (currentNodeDensity < 100) {
          nextNodeDensity = Math.min(100, currentNodeDensity + 2);
        } else if (currentLineDist < 100) {
          nextLineDist = Math.min(100, currentLineDist + 5);
          nextNodeDist = Math.min(100, currentNodeDist + 5);
        } else if (currentLineDensity < 100) {
          nextLineDensity = Math.min(100, currentLineDensity + 1);
        } else if (currentThin > 0.4) {
          nextThin = Math.max(0.4, currentThin - 0.05);
        } else if (currentXorDensity < 100) {
          nextXorDensity = Math.min(100, currentXorDensity + 1);
        }
      }
    }

    if (nextThin !== currentThin || nextLineDist !== currentLineDist || nextNodeDist !== currentNodeDist ||
      nextLineDensity !== currentLineDensity || nextNodeDensity !== currentNodeDensity || nextXorDensity !== currentXorDensity) {

      thinSlider.value = nextThin;
      lineDistSlider.value = nextLineDist;
      nodeDistSlider.value = nextNodeDist;
      lineDensitySlider.value = nextLineDensity;
      nodeDensitySlider.value = nextNodeDensity;
      xorDensitySlider.value = nextXorDensity;

      // Apply to viewers
      [mainViewer, compareViewer].forEach(v => {
        if (v) {
          v.setThinning(nextThin);
          v.setLineDist(nextLineDist);
          v.setNodeDist(nextNodeDist);
          v.setLineDensity(nextLineDensity);
          v.setNodeDensity(nextNodeDensity);
          v.setXorDensity(nextXorDensity);
        }
      });
    }
  }
});
