export const uiElements = {
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

const panelA = document.getElementById('panel-a');
const panelB = document.getElementById('panel-b');

export function setActivePanelStyle(slot) {
  if (!panelA || !panelB) return;

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

export async function handleLoadCrystal(data, slot, viewers) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.remove('hidden');

  const ui = slot === 'main' ? uiElements.main : uiElements.compare;
  const viewer = slot === 'main' ? viewers.main : viewers.compare;

  if (ui.superTitle) ui.superTitle.textContent = data.modelName || 'UNKNOWN CLASS';
  if (ui.title) ui.title.textContent = data.name;
  if (ui.type) ui.type.textContent = data.type;

  try {
    const stats = await viewer.loadCrystal(data.url);

    if (ui.nodes) ui.nodes.textContent = stats.nodes.toLocaleString();
    if (ui.links) ui.links.textContent = stats.links.toLocaleString();

    let infoText = "";
    try {
      const res = await fetch(`./crystals/${data.modelId}/INFO.md`);
      if (res.ok) {
        const text = await res.text();
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

    if (ui.desc) {
      ui.desc.innerHTML = `
            <div class="markdown-content">
                ${parseMarkdown(infoText)}
            </div>
            <br>
            <div style="font-size:0.7em; opacity:0.6;">SOURCE: ${data.url.split('/').pop()}</div>
        `;
    }

  } catch (err) {
    if (ui.title) ui.title.textContent = "LOAD ERROR";
    if (ui.desc) ui.desc.textContent = "Corrupted data.";
  } finally {
    if (loader) loader.classList.add('hidden');
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

  // 2. Headers
  html = html.replace(/^##\s+(.*)$/gm, '<h4 style="color:#00f3ff; margin-top:15px; margin-bottom:5px; text-transform:uppercase;">$1</h4>');
  html = html.replace(/^###\s+(.*)$/gm, '<h5 style="color:#fff; margin-top:10px; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:2px;">$1</h5>');

  // 3. Newlines LAST
  html = html.replace(/\n/gm, '<br>');

  // 4. Cleanup
  html = html.replace(/<\/h4><br>/g, '</h4>');
  html = html.replace(/<\/h5><br>/g, '</h5>');

  return html;
}

export function showToast(msg, isAlert = false) {
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

  void toast.offsetWidth; // Force reflow
  toast.classList.add('show');

  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
