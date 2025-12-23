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

            ${data.diagram ? `
            <div style="margin-top: 15px; border-top: 1px solid rgba(0,243,255,0.2); padding-top: 10px;">
                <button id="toggle-arch-btn-${slot}" style="
                    background: rgba(0,243,255,0.1); 
                    border: 1px solid rgba(0,243,255,0.3); 
                    color: #00f3ff; 
                    padding: 5px 10px; 
                    font-family: 'Rajdhani', sans-serif; 
                    cursor: pointer; 
                    width: 100%;
                    text-transform: uppercase;
                    font-size: 0.8em;
                    letter-spacing: 1px;
                " onclick="
                    const container = document.getElementById('arch-container-${slot}');
                    const btn = document.getElementById('toggle-arch-btn-${slot}');
                    if (container.style.display === 'none') {
                        container.style.display = 'block';
                        btn.textContent = 'HIDE BLUEPRINT';
                        btn.style.background = 'rgba(0,243,255,0.3)';
                    } else {
                        container.style.display = 'none';
                        btn.textContent = 'SHOW BLUEPRINT';
                        btn.style.background = 'rgba(0,243,255,0.1)';
                    }
                ">SHOW BLUEPRINT</button>
                <div id="arch-container-${slot}" style="display:none; margin-top:15px;">
                    <img src="${data.diagram}" style="
                        width: 100%; 
                        border: 1px solid #00f3ff; 
                        box-shadow: 0 0 10px rgba(0,243,255,0.2);
                        margin-bottom: 15px;
                    ">
                    <div style="
                        font-family: 'Rajdhani', sans-serif;
                        font-size: 0.85em;
                        color: rgba(255,255,255,0.9);
                        background: rgba(0,0,0,0.3);
                        padding: 10px;
                        border-left: 2px solid #00f3ff;
                        line-height: 1.4;
                    ">
                        ${getArchDesc(data.diagram)}
                    </div>
                </div>
            </div>
            ` : ''}

            <br>
            <div style="font-size:0.7em; opacity:0.6; margin-top:5px;">SOURCE: ${data.url.split('/').pop()}</div>
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

const archDescriptions = {
  'transformer_blueprint.png': "<strong>TYPE: TRANSFORMER</strong><br><em style='opacity:0.7'>MECHANISM: SELF-ATTENTION</em><br><br>The fundamental architecture of modern AI. Uses 'Attention Heads' to process entire sequences in parallel, weighing relationships between all tokens simultaneously.",
  'decoder_blueprint.png': "<strong>TYPE: DECODER-ONLY TRANSFORMER</strong><br><em style='opacity:0.7'>MECHANISM: AUTOREGRESSIVE GENERATION</em><br><br>The standard for LLMs (GPT, Llama). A stack of masked attention layers that predicts tokens sequentially. Specialized for massive scale text generation.",
  'moe_blueprint.png': "<strong>TYPE: MIXTURE-OF-EXPERTS (MoE)</strong><br><em style='opacity:0.7'>MECHANISM: SPARSE GATING</em><br><br>A massive sparse network. A 'Gating' router selects only the relevant 'Expert' blocks for each token, allowing trillions of parameters with low inference cost.",
  'cnn_blueprint.png': "<strong>TYPE: CONVOLUTIONAL NETWORK (LeNet)</strong><br><em style='opacity:0.7'>MECHANISM: SPATIAL FILTERING</em><br><br>The vision pioneer (Yann LeCun, 1989).<br><br><strong>Historical Context:</strong> Used by banks to automatically read handwritten numbers on checks (MNIST Dataset).<br><br><strong>Architecture:</strong> Uses sliding filters to compress raw pixels (Bottom) into abstract digits (Top).",
  'gan_blueprint.png': "<strong>TYPE: GENERATIVE ADVERSARIAL NETWORK</strong><br><em style='opacity:0.7'>MECHANISM: ZERO-SUM GAME</em><br><br>Two networks at war: A Generator creating fakes, and a Discriminator detecting them. This conflict drives the evolution of realistic synthesis.",
  'lstm_blueprint.png': "<strong>TYPE: LSTM (Recurrent)</strong><br><em style='opacity:0.7'>MECHANISM: GATED MEMORY CELLS</em><br><br>The memory solver. Introduces 'Forget', 'Input', and 'Output' gates to control information flow, solving the vanishing gradient problem of early RNNs.",
  'multimodal_blueprint.png': "<strong>TYPE: MULTIMODAL FUSION</strong><br><em style='opacity:0.7'>MECHANISM: JOINT EMBEDDING SPACE</em><br><br>Dual encoders (Vision + Text) projecting data into a shared conceptual space. Allows the model to 'see' and 'read' simultaneously."
};

function getArchDesc(path) {
  if (!path) return '';
  const filename = path.split('/').pop();
  return archDescriptions[filename] || "";
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
