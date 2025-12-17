import * as THREE from 'three';

export class LightCycleArena {
  constructor(scene) {
    this.scene = scene;
    this.bikes = [];
    // 4 Players: Blue, Yellow, Red, Green (Tron/Clu/Rinzler/Programs)
    this.colors = [0x0088ff, 0xffaa00, 0xff0044, 0x00ff88];
    this.names = ["BLUE", "GOLD", "RED", "GREEN"];
    this.scores = [0, 0, 0, 0];

    this.bounds = { xMin: -60, xMax: 60, zMin: -60, zMax: 60 };
    this.allTrails = [];
    this.active = false;

    // Create Scoreboard DOM
    this.scoreboard = document.createElement('div');
    this.scoreboard.className = 'arena-scoreboard';
    document.body.appendChild(this.scoreboard);

    this._tempVec = new THREE.Vector3();
    this._tempMat = new THREE.Matrix4();
    this.frameCount = 0;
  }

  init() {
    this.cleanUp(true);
    this.active = true;

    this.colors.forEach((col, i) => {
      this.spawnBike(col, i);
    });
  }

  spawnBike(color, index) {
    const zStart = -30;
    const speeds = [0.9, 0.95];

    const bikeGroup = this.createMesh(color);
    const trailGroup = new THREE.Group();
    this.scene.add(bikeGroup);
    this.scene.add(trailGroup);

    // Start Logic
    const bikeState = {
      id: index,
      mesh: bikeGroup,
      trailContainer: trailGroup,
      color: color,
      dir: new THREE.Vector3(1, 0, 0),
      speed: speeds[index % 2],
      turnTimer: Math.random() * 100,
      currentTrail: null,
      lastTurnPos: new THREE.Vector3(),
      isDead: false,
      respawnTimer: 0
    };

    // Random Start Pos (Tighter circle)
    bikeGroup.position.set((Math.random() - 0.5) * 80, -10, (Math.random() - 0.5) * 80);
    bikeState.lastTurnPos.copy(bikeGroup.position);

    this.bikes.push(bikeState);
  }

  createMesh(color) {
    const group = new THREE.Group();

    // MATERIALS
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 });
    const glowMat = new THREE.MeshBasicMaterial({ color: color });

    // Capsule Body
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 8), bodyMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.3;
    group.add(body);

    // Stripe
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.3), glowMat);
    strip.position.set(0, 0.55, 0);
    group.add(strip);

    // Wheels
    const wheelGeo = new THREE.TorusGeometry(0.3, 0.05, 6, 16);
    const wMat = new THREE.MeshBasicMaterial({ color: color });
    const fWheel = new THREE.Mesh(wheelGeo, wMat); fWheel.position.set(0.5, 0.3, 0); group.add(fWheel);
    const bWheel = new THREE.Mesh(wheelGeo, wMat); bWheel.position.set(-0.5, 0.3, 0); group.add(bWheel);

    group.scale.set(0.6, 0.6, 0.6);
    return group;
  }


  update() {
    this.frameCount++;
    this.bikes.forEach((bike, index) => {
      if (bike.isDead) {
        this.handleRespawn(bike);
        return;
      }

      // 1. Move
      const nextPos = bike.mesh.position.clone().addScaledVector(bike.dir, bike.speed);

      // 2. Collision Check (Pre-Move)
      const hitResult = this.checkCollision(nextPos, bike);
      if (hitResult) {
        let killer = null;
        if (hitResult !== true && hitResult.id !== bike.id) {
          killer = hitResult;
        }
        this.explode(bike, killer);
        return;
      }

      bike.mesh.position.copy(nextPos);
      bike.mesh.rotation.y = Math.atan2(bike.dir.x, bike.dir.z);

      // 3. AI Logic - STAGGERED UPDATE (Optimization)
      // Only run 1 AI per frame to reduce load
      if ((this.frameCount + index) % 4 === 0) {
        this.updateAI(bike);
      }

      // 4. Trails
      this.updateTrails(bike);
    });
  }

  checkCollision(pos, selfBike) {
    if (pos.x > this.bounds.xMax || pos.x < this.bounds.xMin ||
      pos.z > this.bounds.zMax || pos.z < this.bounds.zMin) {
      return true;
    }

    // Reuse Temp Vars
    const tmpV = this._tempVec;
    const tmpM = this._tempMat;

    for (const bike of this.bikes) {
      if (bike.mesh.position.distanceToSquared(pos) > 25000) continue;

      for (const segment of bike.trailContainer.children) {
        if (segment === selfBike.currentTrail) continue;

        // Use Cached Data or Active Data
        let len, invMat;

        if (segment.userData.cachedLen) {
          len = segment.userData.cachedLen;
          invMat = segment.userData.cachedInvMat; // Cached Matrix4
        } else {
          // Dynamic (Active Segment)
          len = segment.scale.x;
          segment.updateMatrixWorld();
          tmpM.copy(segment.matrixWorld).invert();
          invMat = tmpM;
        }

        // Fast Sphere Check
        const distSq = pos.distanceToSquared(segment.position);
        if (distSq > (len / 2 + 2) * (len / 2 + 2)) continue;

        // OBB Check
        // Transform world pos to local
        tmpV.copy(pos).applyMatrix4(invMat);

        const halfLen = len / 2;
        if (Math.abs(tmpV.x) < halfLen + 0.5 &&
          Math.abs(tmpV.y) < 2.0 &&
          Math.abs(tmpV.z) < 0.8) {
          return bike;
        }
      }
    }
    return false;
  }

  updateAI(bike) {
    if (bike.isDead) return;

    // FIND ENEMY
    let enemy = null;
    let minDist = 999;

    // Target closest enemy
    for (const other of this.bikes) {
      if (other !== bike && !other.isDead) {
        const d = bike.mesh.position.distanceTo(other.mesh.position);
        if (d < minDist) { minDist = d; enemy = other; }
      }
    }

    // STATE MACHINE
    let action = 'FORWARD';

    // 1. SAFETY CHECK (Immediate forward blocked?)
    const lookAheadDist = 18; // Increased lookahead
    const forwardPos = bike.mesh.position.clone().addScaledVector(bike.dir, lookAheadDist);
    if (!this.isPositionSafe(forwardPos, bike)) {
      action = 'TURN_NEEDED';
    }

    // 2. AGGRESSION (Hunter Strategy)
    // If safe, try to turn towards enemy to cut them off
    if (action === 'FORWARD' && enemy) {
      const toEnemy = new THREE.Vector3().subVectors(enemy.mesh.position, bike.mesh.position);
      const dist = toEnemy.length();

      // Attack Range: wider range
      if (dist < 150 && dist > 15) {
        let targetDir = new THREE.Vector3();
        // Determine cardinal direction towards enemy
        if (Math.abs(toEnemy.x) > Math.abs(toEnemy.z)) {
          targetDir.set(Math.sign(toEnemy.x), 0, 0);
        } else {
          targetDir.set(0, 0, Math.sign(toEnemy.z));
        }

        // If we are perpendicular, consider turning
        if (Math.abs(bike.dir.dot(targetDir)) < 0.1) {
          // Check if that turn is safe
          const turnLookAhead = bike.mesh.position.clone().addScaledVector(targetDir, lookAheadDist);
          if (this.isPositionSafe(turnLookAhead, bike)) {
            // Higher Aggression: 15% chance per frame to commit to the cut-off if safe
            // (Was 8% - 0.92)
            if (Math.random() > 0.85) {
              bike.dir.copy(targetDir);
              this.startNewTrailSegment(bike);
            }
          }
        }
      }
    }

    // 3. RECOVERY
    if (action === 'TURN_NEEDED') {
      this.turnBike(bike);
    }

    // Random Jitter (Reduced to focus on combat)
    if (Math.random() > 0.995) this.turnBike(bike);
  }

  isPositionSafe(pos, bike) {
    if (pos.x > this.bounds.xMax || pos.x < this.bounds.xMin ||
      pos.z > this.bounds.zMax || pos.z < this.bounds.zMin) return false;

    // Reuse new checkCollision but treat any object return as "unsafe"
    if (this.checkCollision(pos, bike)) return false;

    return true;
  }

  // ... turnBike same ...

  explode(bike, killer) {
    if (bike.isDead) return;

    bike.isDead = true;
    bike.respawnTimer = 120;
    bike.mesh.visible = false;
    this.startNewTrailSegment(bike);
    this.clearTrails(bike);

    // Score Logic
    // Victim loses 1
    this.scores[bike.id] = Math.max(0, this.scores[bike.id] - 1);

    // Killer gets 2 (Incentivize kills)
    if (killer) {
      this.scores[killer.id] += 2;
      console.log(`KILL: ${this.names[killer.id]} Derezzed ${this.names[bike.id]}`);
    } else {
      console.log(`SUICIDE: ${this.names[bike.id]} hit a wall.`);
    }

    this.updateScoreboard();

    // Effect
    // ... boom ...
    const boomGeo = new THREE.SphereGeometry(3, 16, 16);
    const boomMat = new THREE.MeshBasicMaterial({ color: bike.color, transparent: true, opacity: 1.0 });
    const boom = new THREE.Mesh(boomGeo, boomMat);
    boom.position.copy(bike.mesh.position);
    this.scene.add(boom);

    const animateBoom = () => {
      boom.scale.multiplyScalar(1.1);
      boom.material.opacity -= 0.03;
      if (boom.material.opacity > 0) requestAnimationFrame(animateBoom);
      else {
        this.scene.remove(boom);
        boom.geometry.dispose();
        boom.material.dispose();
      }
    };
    animateBoom();
  }

  handleRespawn(bike) {
    bike.respawnTimer--;
    if (bike.respawnTimer <= 0) {
      bike.isDead = false;
      bike.mesh.visible = true;
      // Respawn Safe
      bike.mesh.position.set((Math.random() - 0.5) * 100, -10, (Math.random() - 0.5) * 100);
      bike.lastTurnPos.copy(bike.mesh.position);

      // Pick random safe dir
      bike.dir.set(Math.random() > 0.5 ? 1 : -1, 0, 0);
      if (Math.random() > 0.5) bike.dir.set(0, 0, Math.random() > 0.5 ? 1 : -1);

      bike.turnTimer = 100;
      this.startNewTrailSegment(bike);
      this.updateScoreboard();
    }
  }

  toggle() {
    if (this.active) {
      this.cleanUp();
      this.scoreboard.classList.remove('active');
    } else {
      if (!this.scoreboard.parentNode) document.body.appendChild(this.scoreboard);
      this.scores = [0, 0, 0, 0]; // Reset scores
      this.init();
      this.scoreboard.classList.add('active');
      this.updateScoreboard();
    }
  }

  updateScoreboard() {
    if (!this.scoreboard) return;
    this.scoreboard.innerHTML = '';

    this.bikes.forEach(bike => {
      const row = document.createElement('div');
      row.className = 'score-row';

      // Color Dot
      const dot = document.createElement('div');
      dot.className = 'score-color-dot';
      dot.style.backgroundColor = '#' + bike.color.toString(16).padStart(6, '0');
      dot.style.color = dot.style.backgroundColor; // For shadow

      const name = document.createElement('span');
      name.textContent = this.names[bike.id];

      const score = document.createElement('span');
      score.className = 'score-val';
      score.textContent = this.scores[bike.id];

      const status = document.createElement('span');
      status.className = 'score-status';
      if (bike.isDead) {
        status.textContent = 'DEREZZED';
        status.classList.add('dead');
      } else {
        status.textContent = 'ACTIVE';
      }

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(status);
      row.appendChild(score); // Right-aligned? Need flex style tweak or spacer
      // Actually justify-between handles spacing.

      this.scoreboard.appendChild(row);
    });
  }

  cleanUp(keepScores = false) { // Arg to support init reset
    this.active = false;
    this.bikes.forEach(b => {
      this.scene.remove(b.mesh);
      this.scene.remove(b.trailContainer);
      b.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      b.trailContainer.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    });
    this.bikes = [];
    if (!keepScores) {
      if (this.scoreboard && this.scoreboard.parentNode) this.scoreboard.parentNode.removeChild(this.scoreboard);
    }
  }
  updateTrails(bike) {
    if (bike.currentTrail) {
      // Stretch
      const start = bike.lastTurnPos;
      const end = bike.mesh.position;
      const dist = start.distanceTo(end);

      if (dist > 0.1) {
        bike.currentTrail.position.lerpVectors(start, end, 0.5);
        bike.currentTrail.position.y = -9.7;
        bike.currentTrail.lookAt(end);
        bike.currentTrail.rotateY(Math.PI / 2);
        bike.currentTrail.scale.set(dist, 0.6, 1);
      }
    } else {
      this.startNewTrailSegment(bike);
    }

    const MAX_TRAILS = 30;
    if (bike.trailContainer.children.length > MAX_TRAILS) {
      const old = bike.trailContainer.children[0];
      if (old !== bike.currentTrail) {
        bike.trailContainer.remove(old);
        if (old.geometry) old.geometry.dispose();
      }
    }
  }

  startNewTrailSegment(bike) {
    // Cache data for the finished segment (it becomes static now)
    if (bike.currentTrail) {
      bike.currentTrail.updateMatrixWorld();
      bike.currentTrail.userData.cachedLen = bike.currentTrail.scale.x;
      // We MUST clone here because we need a persistent matrix for this object
      bike.currentTrail.userData.cachedInvMat = bike.currentTrail.matrixWorld.clone().invert();
    }

    bike.lastTurnPos = bike.mesh.position.clone();

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: bike.color, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const segment = new THREE.Mesh(geo, mat);
    segment.position.copy(bike.mesh.position);

    bike.trailContainer.add(segment);
    bike.currentTrail = segment;
  }

  clearTrails(bike) {
    while (bike.trailContainer.children.length > 0) {
      const c = bike.trailContainer.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    bike.currentTrail = null;
  }

  cleanUp(keepScores = false) {
    this.active = false;
    this.bikes.forEach(b => {
      this.scene.remove(b.mesh);
      this.scene.remove(b.trailContainer);
      b.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      b.trailContainer.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    });
    this.bikes = [];
    if (!keepScores) {
      // Scores reset manually if needed, or we just keep them persistent?
      // Let's just reset scores if fully stopping?
      // this.scores = [0,0,0,0]; // Optional: Reset scores on stop
    }
  }
}
