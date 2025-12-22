import { handleLoadCrystal } from './Panels.js';

const navList = document.getElementById('model-list');
const filterState = {
  query: '',
  tag: 'ALL'
};

export async function initGallery(activeSlotGetter, viewers) {
    const models = await loadGallery(activeSlotGetter, viewers);
    setupSearch();
    return models;
}

async function loadGallery(activeSlotGetter, viewers) {
  try {
    const res = await fetch('./crystals/manifest.json');
    let models = await res.json();

    // Sort by Year (Descending)
    models.sort((a, b) => b.year - a.year);

    setupTags(models);

    models.forEach((model, index) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'model-group';
        if (index === 0) groupDiv.classList.add('active');

        const groupTitle = document.createElement('div');
        groupTitle.className = 'model-title';
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
            item.dataset.modelName = model.name;
            item.dataset.modelDesc = model.desc;
            item.dataset.modelId = model.id;
          item.dataset.diagram = model.diagram || '';

            item.innerHTML = `
                <span class="item-name">${crystal.name}</span>
                <span class="item-desc">${crystal.desc.substring(0, 35)}...</span>
            `;

            item.addEventListener('click', () => {
                document.querySelectorAll('.crystal-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                // Call Panel Handler
                const currentSlot = activeSlotGetter(); // Call getter to get current string
                handleLoadCrystal(item.dataset, currentSlot, viewers);
                
                // Close mobile menu
                const mobileMenu = document.querySelector('.gallery-nav');
                if (mobileMenu) mobileMenu.classList.remove('active');
            });

            contentDiv.appendChild(item);
        });

        groupDiv.appendChild(contentDiv);
        navList.appendChild(groupDiv);
    });

    // Auto-select first
    setTimeout(() => {
      const firstItem = navList.querySelector('.crystal-item');
      if (firstItem) firstItem.click();
    }, 100);

    return models;

    } catch (err) {
      console.error("Failed to load manifest:", err);
      if (navList) navList.innerHTML = `<div style="color:red; padding:1rem;">ERROR CONNECTING TO ARCHIVE<br>${err.message}</div>`;
      return null;
    }
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterState.query = e.target.value.toLowerCase();
        applyFilters();
      });
  }
}

function setupTags(models) {
  const container = document.getElementById('filter-tags');
  if (!container) return;

  container.innerHTML = '';
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
