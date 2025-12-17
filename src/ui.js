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
let isCompareMode = false;
let activeSlot = 'main'; // 'main' or 'compare'
let mainViewer = null;
let compareViewer = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Init Viewers
  mainViewer = new CrystalViewer('view-main');
  compareViewer = new CrystalViewer('view-compare'); 

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

  if (btnToggleInfo) {
    document.getElementById('btn-toggle-info').addEventListener('click', () => {
      const panels = document.querySelectorAll('.artifact-details, .gallery-nav');
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

  btnSpin.addEventListener('click', () => {
    const isActive = btnSpin.classList.toggle('active');
    mainViewer.setAutoRotate(isActive);
    compareViewer.setAutoRotate(isActive);
    btnSpin.textContent = isActive ? "AUTO-ROTATE: ON" : "AUTO-ROTATE: OFF";
  });

  btnReset.addEventListener('click', () => {
    mainViewer.resetView();
    compareViewer.resetView();
  });

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
}
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
