export const Templates = {
    aboutModal: `
            <div class="modal-content glass-panel" style="background: rgba(10, 20, 30, 0.95); max-width: 600px; padding: 30px;">
                <button id="btn-close-modal" class="modal-close-large">&times;</button>
                <h2 style="color:var(--color-primary); margin-top:0;">THE PRISMATA PROJECT</h2>
                <div class="modal-body">
                    <p class="highlight" style="font-size:1.1rem; color:#fff; margin-bottom:20px;">Visualizing the
                        invisible
                        geometry of intelligence.</p>
                    <p style="margin-bottom:20px; color:#ccc;">Prismata transforms the raw mathematical weights of
                        Neural Networks into 3D crystalline structures. By applying PCA (Principal Component Analysis) to layer
                        weights, we
                        reveal the unique "fingerprint" of each architecture.</p>
        
                    <div
                        style="background: rgba(0,243,255,0.02); padding: 15px; border-left: 2px solid var(--color-secondary); margin-bottom: 20px;">
                        <h3 style="font-size:0.8rem; color:var(--color-primary); letter-spacing:1px; margin-top:0;">NEW: CORTEX
                            INTERFACE
                        </h3>
                        <ul style="font-size:0.8rem; color:#aaa; padding-left:15px; margin:5px 0;">
                            <li><strong>Real-time Inference:</strong> In-browser neural search.</li>
                            <li><strong>Sonification:</strong> Generative audio signatures for every model.</li>
                            <li><strong>???:</strong> Rumors of a defensive anomaly in the Archive...</li>
                        </ul>
                    </div>

                    <div
                        style="margin: 20px 0; padding: 15px; background: rgba(0,243,255,0.05); border-left: 2px solid var(--color-primary);">
                        <h3 style="font-size:0.8rem; color:var(--color-secondary); letter-spacing:1px;">AUTHORS</h3>
                        <p style="margin-bottom:10px;">Created by <a href="https://www.linkedin.com/in/freddyayala/" target="_blank"
                                style="color:#fff; text-decoration:underline;">Frederic Ayala</a>
                        </p>

                        <h3 style="font-size:0.8rem; color:var(--color-secondary); letter-spacing:1px; margin-top:10px;">
                            CONTRIBUTE</h3>
                        <p>Follow the <a href="https://github.com/FreddyAyala/Prismata/blob/main/CONTRIBUTING.md" target="_blank"
                                style="color:#fff; text-decoration:underline;">Contribution
                                Guide</a> on GitHub.
                        </p>
                        </div>

                    <div class="upload-section" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:20px; margin-top:20px;">
                        <h3 style="color:var(--color-secondary); font-size:0.9rem;">PREVISUALIZE CUSTOM CRYSTAL</h3>
                        <p style="font-size:0.8rem; margin-bottom:10px; color:#ccc;">Upload a generated
                            <code>.ply</code> file
                            to view it instantly.
                        </p>
                        <label class="minimal-btn" style="display:inline-block; cursor:pointer; padding: 8px 16px;">
                            UPLOAD .PLY
                            <input type="file" id="file-upload" accept=".ply" style="display:none;">
                        </label>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(0,243,255,0.2); text-align: center;">
                            <h3 style="color:#00ffff; font-size:1.0rem; letter-spacing: 2px; margin-bottom: 10px;">THE ORIGIN STORY</h3>
                            <button onclick="window.location.href='/public/journey.html'" class="cyber-btn"
                                style="width: 100%; padding: 15px; font-size: 1.1rem; border: 1px solid #00ffff; background: rgba(0,243,255,0.1); color: #00ffff; text-shadow: 0 0 10px #00ffff; cursor: pointer;">BEGIN
                                JOURNEY</button>
                        </div>
                    </div>
                </div>
    `,
    
    advancedControls: `
                    <div class="accordion-toggle">
                        <span>ADVANCED CONTROLS</span>
                        <svg class="chevron" viewBox="0 0 24 24" width="16" height="16">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                    <div class="accordion-content" style="display:none; background: rgba(0,0,0,0.4);">
                
                        <!-- Sub Tabs -->
                        <div class="tab-row">
                            <button class="tab-btn active" data-tab="tab-move">MOVEMENT</button>
                            <button class="tab-btn" data-tab="tab-perf">VISUALS</button>
                        </div>
                
                        <!-- MOVEMENT TAB -->
                        <div id="tab-move" class="control-group active">
                
                            <div class="control-row">
                                <label>PAN SPEED</label>
                                <input type="range" id="pan-speed" min="0" max="2" step="0.1" value="0.5">
                            </div>
                            <div class="control-row">
                                <label>PAN LIMITS (Y)</label>
                                <div class="dual-input-row">
                                    <input type="number" id="pan-min" value="-5" step="1">
                                    <input type="number" id="pan-max" value="10" step="1">
                                </div>
                            </div>
                            <div class="control-row">
                                <label>VIEW HEIGHT</label>
                                <input type="range" id="view-height" min="-20" max="60" step="1" value="20">
                            </div>
                            <div class="control-row">
                                <label>ROTATION SPEED</label>
                                <input type="range" id="rot-speed" min="0" max="10" step="0.5" value="2.0">
                            </div>
                            <div class="control-row checkbox-row"
                                style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                                <label style="color:#00f3ff">HORIZONTAL MODE</label>
                                <label class="toggle-switch small">
                                    <input type="checkbox" id="horizontal-toggle">
                                    <span class="slider" style="background-color:#444;"></span>
                                </label>
                            </div>
                        </div>
                
                        <!-- PERFORMANCE/VISUALS TAB -->
                        <div id="tab-perf" class="control-group hidden">
                            <div class="control-row checkbox-row">
                                <label class="gold-text">AUTO FPS GOVERNOR</label>
                                <label class="toggle-switch small">
                                    <input type="checkbox" id="auto-fps-toggle" checked>
                                    <span class="slider gold"></span>
                                </label>
                            </div>
                            <div class="separator-line"></div>
                
                            <div class="control-row">
                                <label>NODE SIZE</label>
                                <input type="range" id="node-size" min="0.01" max="1.0" step="0.01" value="0.15">
                            </div>
                            <div class="control-row">
                                <label>PULSE AMOUNT</label>
                                <input type="range" id="lfo-amt" min="0" max="1" step="0.1" value="0.5">
                            </div>
                            <div class="control-row">
                                <label>XOR VISIBLE</label>
                                <input type="range" id="xor-density" min="0" max="1" step="0.05" value="0.0">
                            </div>
                
                            <div class="separator-line"></div>
                
                            <div class="control-row">
                                <label>LINE DISTANCE</label>
                                <input type="range" id="line-dist" min="0" max="200" step="1" value="200">
                            </div>
                            <div class="control-row">
                                <label>LINE DENSITY</label>
                                <input type="range" id="line-density" min="0" max="1" step="0.05" value="1.0">
                            </div>
                            <div class="control-row">
                                <label>NODE DENSITY</label>
                                <input type="range" id="node-density" min="0" max="1" step="0.05" value="1.0">
                            </div>
                            <div class="control-row">
                                <label>THINNING</label>
                                <input type="range" id="thinning" min="0" max="1" step="0.05" value="0.0">
                            </div>
                            <div class="separator-line"></div>
                            <button id="btn-reset-advanced" class="cyber-btn small" style="width:100%; margin-top:8px;">RESET
                                DEFAULTS</button>
                        </div>
                
                    </div>
    `,

    mobileDock: `
                <button id="dock-btn-info" class="dock-btn active" data-target="panel-info">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    <span>INFO</span>
                </button>
                <button id="dock-btn-cortex" class="dock-btn" data-target="panel-cortex">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                    <span>CORTEX</span>
                </button>
                <button id="dock-btn-controls" class="dock-btn" data-target="sketch-controls">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path
                            d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
                    </svg>
                    <span>CONTROLS</span>
                </button>
    `
};

export function injectTemplates() {
    // 1. About Modal
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.innerHTML = Templates.aboutModal;
    }

    // 2. Advanced Controls
    // We need to target the .advanced-controls div (which we should give an ID or finding by class)
    // index.html has: <div class="advanced-controls" ...>
    // Let's add an ID `advanced-controls-container` to it in index.html for safety, or select by class.
    const advControls = document.querySelector('.advanced-controls');
    if (advControls) {
        advControls.innerHTML = Templates.advancedControls;
    }

    // 3. Mobile Dock
    const dock = document.getElementById('mobile-dock');
    if (dock) {
        dock.innerHTML = Templates.mobileDock;
    }
}
