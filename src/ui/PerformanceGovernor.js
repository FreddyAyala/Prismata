export class PerformanceGovernor {
  constructor(viewers) {
    this.viewers = viewers;
    this.isMonitoring = false;
    this.stabilityCooldown = 0; // Frames to wait after a change
    this.minFPS = 30;
    this.targetFPS = 55;
    
    // Quality Levels (Visual Parameters)
    this.qualityState = {
        density: 1.0,
        thinning: 0.0 // 0 = no thinning (max quality)
    };
    
    this.boundUpdate = this.onFPSUpdate.bind(this);
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    window.addEventListener('fps-update', this.boundUpdate);
    console.log("Performance Governor: ENGAGED");
  }

  stop() {
    this.isMonitoring = false;
    window.removeEventListener('fps-update', this.boundUpdate);
  }

  onFPSUpdate(e) {
    if (!this.isMonitoring) return;
    
    const fps = e.detail.fps;
    
    // Cooldown logic
    if (this.stabilityCooldown > 0) {
        this.stabilityCooldown--;
        return;
    }

    // Simple Governor Logic
    if (fps < this.minFPS) {
        // Drop Quality
        this.reduceQuality();
        this.stabilityCooldown = 3; // Wait 3 seconds (approx, since this called 1x/sec) 
        // actually fps-update is called 1x/sec, so 3 ticks = 3 seconds.
    } else if (fps > this.targetFPS) {
        // Improve Quality slowly
        this.improveQuality();
    }
  }

  reduceQuality() {
      // Reduce density, increase thinning
      if (this.qualityState.density > 0.1) {
          this.qualityState.density -= 0.1;
          this.applyState();
          console.log("Governor: Reducing Quality", this.qualityState);
      }
  }

  improveQuality() {
      if (this.qualityState.density < 1.0) {
          this.qualityState.density += 0.05;
          this.applyState();
      }
  }

  applyState() {
      // Apply to all viewers
      Object.values(this.viewers).forEach(viewer => {
          if (viewer && viewer.setNodeDensity) viewer.setNodeDensity(this.qualityState.density);
          if (viewer && viewer.setLineDensity) viewer.setLineDensity(this.qualityState.density);
      });
  }
}
