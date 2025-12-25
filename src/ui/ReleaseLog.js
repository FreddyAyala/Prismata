import { RELEASE_LOG } from '../data/ReleaseData.js';
import { uiElements } from './Panels.js';

export class ReleaseLog {
  constructor() {
    this.currentVersion = RELEASE_LOG[0].version;
    this.storageKey = 'prismata_last_version';
    this.hasNew = this.checkIfNew();

    this.initUI();
  }

  checkIfNew() {
    const lastSeen = localStorage.getItem(this.storageKey);
    return lastSeen !== this.currentVersion;
  }

  markAsSeen() {
    localStorage.setItem(this.storageKey, this.currentVersion);
    this.hasNew = false;
    this.updateBadge();
  }

  initUI() {
    // 1. DESKTOP NOTIFICATION (Icon)
    const initDesktop = () => {
      const container = document.querySelector('.desktop-controls');
      if (container) {
        console.log("🔔 ReleaseLog: Injecting Desktop Icon");
        this.desktopBtn = document.createElement('button');
        this.desktopBtn.className = 'icon-btn release-log-btn';
        this.desktopBtn.title = "What's New";
        // Removed Debug Styles

        this.desktopBtn.innerHTML = `
                    <div class="notification-badge hidden"></div>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
                    </svg>
                `;

        // Insert before About button
        const btnAbout = document.getElementById('btn-about');
        if (btnAbout) container.insertBefore(this.desktopBtn, btnAbout);
        else container.appendChild(this.desktopBtn);

        this.desktopBtn.addEventListener('click', () => this.toggleModal());
      }
    };

    // 2. MOBILE NOTIFICATION (Dropdown Item)
    const initMobile = () => {
      const mobileDropdown = document.getElementById('mobile-dropdown');
      if (mobileDropdown) {
        console.log("🔔 ReleaseLog: Injecting Mobile Menu Item");
        this.mobileItem = document.createElement('button');
        this.mobileItem.className = 'dropdown-item';
        this.mobileItem.style.position = 'relative'; // For badge
        this.mobileItem.innerHTML = `
                    WHAT'S NEW
                    <div class="notification-badge hidden" style="top: 12px; right: 8px;"></div>
                `;

        // Insert at top
        mobileDropdown.insertBefore(this.mobileItem, mobileDropdown.firstChild);

        this.mobileItem.addEventListener('click', () => {
          this.toggleModal();
          // Close dropdown
          mobileDropdown.classList.add('hidden');
        });
      }
    };

    // Retry Loop for Safety
    let retries = 5;
    const tryInit = () => {
      if (!this.desktopBtn) initDesktop();
      if (!this.mobileItem) initMobile();

      this.updateBadge();

      if ((!this.desktopBtn || !this.mobileItem) && retries > 0) {
        retries--;
        setTimeout(tryInit, 500);
      }
    };

    // Start
    tryInit();

    // Create Modal
    this.modal = document.createElement('div');
    this.modal.id = 'release-modal';
    this.modal.className = 'modal-overlay hidden';
    this.modal.innerHTML = `
            <div class="modal-content glass-panel" style="max-width: 650px; padding: 0;">
                <div class="modal-header" style="padding: 20px; border-bottom: 1px solid rgba(0,243,255,0.2); display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="color:var(--color-primary); margin:0; letter-spacing:2px;">SYSTEM UPDATES</h2>
                    <button class="close-btn" style="background:none; border:none; color:var(--color-primary); font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="modal-body scroll-container" style="padding: 20px; max-height: 60vh; overflow-y:auto;">
                    ${this.renderLog()}
                </div>
            </div>
        `;
    document.body.appendChild(this.modal);

    // Bind Close
    this.modal.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
  }

  renderLog() {
    return RELEASE_LOG.map(log => `
            <div class="release-entry" style="margin-bottom: 30px; border-left: 2px solid ${log.isNew ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)'}; padding-left: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3 style="color:${log.isNew ? 'var(--color-accent)' : '#fff'}; font-size:1rem; margin:0;">${log.title}</h3>
                    <span style="font-family:'JetBrains Mono'; font-size:0.7rem; opacity:0.6;">v${log.version} // ${log.date}</span>
                </div>
                <ul style="list-style:none; padding:0; margin:0;">
                    ${log.features.map(f => {
      // Bold parsing
      const html = f.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--color-primary)">$1</strong>');
      return `<li style="margin-bottom:8px; font-size:0.85rem; line-height:1.4; color:#ccc;">${html}</li>`;
    }).join('')}
                </ul>
            </div>
        `).join('');
  }

  updateBadge() {
    const toggleBadge = (parent) => {
      if (!parent) return;
      const badge = parent.querySelector('.notification-badge');
      if (badge) {
        if (this.hasNew) {
          badge.classList.remove('hidden');
          badge.classList.add('pulse-red');
        } else {
          badge.classList.add('hidden');
          badge.classList.remove('pulse-red');
        }
      }
    };

    if (this.desktopBtn) toggleBadge(this.desktopBtn);
    if (this.mobileItem) toggleBadge(this.mobileItem);
  }
  toggleModal() {
    this.modal.classList.remove('hidden');
    this.markAsSeen();
  }

  closeModal() {
    this.modal.classList.add('hidden');
  }
}
