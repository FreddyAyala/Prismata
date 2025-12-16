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
        const llmTypes = ['Encoder', 'Decoder', 'Enc-Dec', 'Dense Decoder', 'CoT Decoder', 'MoE'];
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
    // Force fresh load to avoid caching old filenames
    const res = await fetch('./crystals/manifest.json?v=' + Date.now());
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
                });

              contentDiv.appendChild(item);
            });

          groupDiv.appendChild(contentDiv);
          navList.appendChild(groupDiv);
        });

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
        if (res.ok) infoText = await res.text();
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
    btnToggleInfo.addEventListener('click', () => {
      const uiLayer = document.querySelector('.ui-layer');
      uiLayer.classList.toggle('no-details');
      const isHidden = uiLayer.classList.contains('no-details');
      btnToggleInfo.textContent = isHidden ? "SHOW INFO" : "HIDE INFO";

      setTimeout(() => {
        if (mainViewer) mainViewer.onResize();
        if (compareViewer) compareViewer.onResize();
      }, 300);
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
