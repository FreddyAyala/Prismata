import * as THREE from 'three';
import { DoomAudio } from './DoomAudio.js';
import { GlitchEnemy } from './DoomEnemy.js';
import { GlitchBoss } from './DoomBoss.js';
import { WEAPONS } from './DoomWeapons.js';
import { DoomUI } from './DoomUI.js';
import { DoomSystems } from './DoomSystems.js';
import { DoomArena } from './DoomArena.js';

export class DoomGame {
  constructor(scene, camera, player = null) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.active = false;

    // Systems
    this.audio = new DoomAudio();
    this.ui = new DoomUI(this);
    this.systems = new DoomSystems(this);
    this.arena = new DoomArena(scene);

    // Game State
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;
    this.enemies = [];
    this.projectiles = [];
    this.boss = null;

    this.spawnInterval = null;
    this.pickupInterval = null;
    this.musicInterval = null;
    this.enemiesToSpawn = 0;
    this.waveInProgress = false;

    // Weapons
    this.weapons = WEAPONS.map(w => ({ ...w }));
    this.currentWeaponIdx = 0;
    this.weaponMesh = null;
    this.muzzleLight = null;
    this.weaponRecoil = 0;
    this.raycaster = new THREE.Raycaster();
    this.isFiring = false;
  }

  activate(exhibits = null, skipIntro = false) {
    if (this.active) return;
    console.log("🛡️ DOOM GAME ACTIVATED - V5 PURPLE (REFACTORED)");
    this.active = true;

    this.ui.createHUD();
    this.exhibitsSource = exhibits || [];

    // Setup input listeners early
    this.setupInputs();

    if (!skipIntro) {
      console.log("DEBUG: Showing Instructions...");
      // DO NOT create arena yet. Wait for user.
      this.ui.showInstructions(() => {
        console.log("DEBUG: Instructions 'Enter' callback triggered. Starting Game...");
        this.startGame();
      });
    } else {
      console.log("DEBUG: Skipping Intro. Starting Game...");
      this.startGame();
      document.body.requestPointerLock();
    }

    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') {
      this.audio.audioCtx.resume();
    }
  }

  startGame() {
    // RESET WEAPONS & STATE
    this.weapons = WEAPONS.map(w => ({
      ...w,
      ammo: w.name === 'BLASTER' ? -1 : 0
    }));
    this.currentWeaponIdx = 0;
    this.playerHealth = 100;
    this.isGameOver = false;
    this.isVictory = false;
    this.score = 0;
    this.wave = 1;
    this.enemiesToSpawn = 0;
    this.waveInProgress = false;

    // Create World
    this.arena.create(this.exhibitsSource); 
    this.createWeaponMesh();
    this.ui.initModelHealthBars(this.exhibitsSource);

    // Go
    this.startWave();
    this.startPickups();
    this.musicInterval = this.audio.playMusic(() => this.active && !this.isGameOver);
  }

  setupInputs() {
    this.mousedownHandler = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      this.isFiring = true;
      this.shoot(e); 
    };
    this.mouseupHandler = () => { this.isFiring = false; };
    document.addEventListener('mousedown', this.mousedownHandler);
    document.addEventListener('mouseup', this.mouseupHandler);

    this.keyParams = { handler: (e) => this.handleKeys(e) };
    window.addEventListener('keydown', this.keyParams.handler);

    this.lockParams = { handler: () => this.handlePointerLockChange() };
    document.addEventListener('pointerlockchange', this.lockParams.handler);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (document.pointerLockElement) document.exitPointerLock();

    // Cleanup
    this.cleanupLevel();

    if (this.mousedownHandler) { document.removeEventListener('mousedown', this.mousedownHandler); this.mousedownHandler = null; }
    if (this.mouseupHandler) { document.removeEventListener('mouseup', this.mouseupHandler); this.mouseupHandler = null; }
    this.isFiring = false;

    if (this.keyParams) { window.removeEventListener('keydown', this.keyParams.handler); this.keyParams = null; }
    if (this.lockParams) {
      document.removeEventListener('pointerlockchange', this.lockParams.handler);
      this.lockParams = null;
    }

    this.ui.removeHUD();
    this.systems.clear();
  }

  cleanupLevel() {
    if (this.weaponMesh) { this.camera.remove(this.weaponMesh); this.weaponMesh = null; }
    this.arena.cleanup();

    if (this.spawnInterval) clearInterval(this.spawnInterval);
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    if (this.musicInterval) clearInterval(this.musicInterval);

    // Clear Entities
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    if (this.boss) { this.scene.remove(this.boss.mesh); this.boss = null; }

    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
  }

  update(delta) {
    if (!this.active || this.isGameOver) return;

    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') this.audio.audioCtx.resume();

    // Enforce Arena Bounds (Player)
    this.arena.constrainCamera(this.camera);

    // Wave Logic
    if (this.waveInProgress && this.enemiesToSpawn === 0 && this.enemies.length === 0 && !this.boss) {
      this.waveInProgress = false;
      this.wave++;
      this.audio.playSound(600, 'sine', 1.0, 0.5);
      setTimeout(() => this.startWave(), 3000);
    }

    this.ui.updateModelHealthBars();

    // Entities Update
    this.updateEnemies(delta);
    this.updateBoss(delta);
    this.updateProjectiles(delta);
    this.systems.updateParticles(delta);
    this.systems.updatePickups(delta, this.camera.position, (type) => this.onPickup(type));
    this.updateWeaponRecoil(delta);
  }

  onPickup(type) {
    if (type === 'health') {
      this.playerHealth = Math.min(100, this.playerHealth + 50);
    } else {
      const ammoMap = { 'ammo_shotgun': ['SHOTGUN', 8], 'ammo_launcher': ['LAUNCHER', 4], 'ammo_plasma': ['PLASMA', 40], 'ammo_bfg': ['BFG 9000', 1] };
      if (ammoMap[type]) {
        const [name, amount] = ammoMap[type];
        const w = this.weapons.find(x => x.name === name);
        if (w) w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
      }
    }
    this.audio.playSound(400, 'sine', 0.1, 0.2);
    this.ui.updateHUD();
  }

  startWave() {
    if (this.spawnInterval) clearInterval(this.spawnInterval);

    if (this.wave === 5) { this.startBossWave(); return; }
    if (this.wave > 5) { this.triggerWin(); return; }

    this.waveInProgress = true;
    this.enemiesToSpawn = 10 + (this.wave * 5);
    const spawnRate = Math.max(500, 2500 - (this.wave * 300));

    this.ui.showWaveTitle(`WAVE ${this.wave}`);

    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.enemiesToSpawn > 0 && this.enemies.length < 20) {
        this.spawnEnemy();
      }
    }, spawnRate);

    this.ui.updateHUD();
  }

  startBossWave() {
    this.waveInProgress = true;
    this.wave = 5; // Force wave to 5 if debug started
    this.ui.showWaveTitle("THE AI BUBBLE: POP IT TO SAVE AI");
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, 5, -60)); // Lower and closer (Was 10, -80)
    const onShoot = (pos, dir, isBoss) => this.fireEnemyProjectile(pos, dir, isBoss);
    this.boss = new GlitchBoss(this.scene, spawnPos, this.camera, onShoot);

    const bossHudContainer = document.createElement('div');
    bossHudContainer.id = 'boss-health-container';
    bossHudContainer.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); width:60%; height:30px; border:2px solid #00ffff; background: rgba(0,50,50,0.5);";
    bossHudContainer.innerHTML = `
        <div id="boss-health-bar" style="width:100%; height:100%; background:#00ffff; transition:width 0.2s;"></div>
        <div style="position:absolute; top:5px; left:50%; transform:translateX(-50%); font-size:16px; color:white; font-weight:bold; text-shadow: 0 0 5px #00ffff;">THE AI BUBBLE</div>
    `;
    if (this.ui.hud) this.ui.hud.appendChild(bossHudContainer);

    this.enemiesToSpawn = 50;
    const spawnRate = 3000;
    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.boss && this.enemies.length < 8) { // Increased minion cap for boss (was 5)
        this.spawnEnemy();
      }
    }, spawnRate);
  }

  spawnEnemy() {
    if (!this.active) return;
    const validTargets = this.ui.crystals.filter(c => c.mesh && c.mesh.visible && c.mesh.userData.health > 0).map(c => c.mesh);

    // Spawn Logic: Prefer closer points
    let spawnPoint = this.arena.getRandomSpawnPoint();
    for (let i = 0; i < 5; i++) {
      const potential = this.arena.getRandomSpawnPoint();
      const dist = potential.distanceTo(this.camera.position);
      // We want them close (thrill) but not ON TOP (min 20) and not miles away (max 110)
      if (dist > 20 && dist < 110) {
        spawnPoint = potential;
        break;
      }
    }

    let target = this.camera;
    // Helper to pick random
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Role Assignment
    const role = Math.random() < 0.4 ? 'destroyer' : 'hunter'; // 40% Destroyers

    if (validTargets.length > 0) {
      if (role === 'destroyer') {
        target = pick(validTargets);
      } else {
        // Hunter prefers player usually, but can target crystal if close
        // We pass 'target' as default, but Hunter logic in Enemy.js overrides to player if close
        target = pick(validTargets);
      }
    }

    let type = 'normal';
    if (this.wave > 1 && Math.random() < 0.3) type = 'imp';
    if (this.wave > 2 && Math.random() < 0.2) type = 'wraith';
    if (this.wave > 3 && Math.random() < 0.15) type = 'tank';
    if (this.wave > 4 && Math.random() < 0.1) type = 'berzerker';
    if (this.wave > 2 && Math.random() < 0.1) type = 'scout';

    const enemy = new GlitchEnemy(this.scene, spawnPoint, target, type, role, (pos, dir) => {
      this.fireEnemyProjectile(pos, dir);
    });
    this.enemies.push(enemy);
    this.enemiesToSpawn--;
  }

  fireEnemyProjectile(start, dir, isBoss = false) {
    let geo, mat, speed, damage;

    if (isBoss) {
      // Virus Orb (Purple, Spiky)
      geo = new THREE.IcosahedronGeometry(0.6, 1);
      mat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, wireframe: true });
      speed = 40;
      damage = 25;
    } else {
      // Standard Projectile
      geo = new THREE.DodecahedronGeometry(0.5);
      mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
      speed = 30;
      damage = 15;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(speed),
      life: 5.0,
      damage: damage,
      isEnemy: true,
      isBossProjectile: isBoss
    });

    const pitch = isBoss ? 100 : 200; // Lower pitch for boss
    if (this.audio) this.audio.playSound(pitch, 'sawtooth', 0.2, 0.5);
  }

  updateEnemies(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const result = e.update(delta, this.camera.position);

      const distToPlayerSq = e.mesh.position.distanceToSquared(this.camera.position);
      if (distToPlayerSq < 25.0) {
        this.takePlayerDamage(e.damage * delta * 2);
      }

      if (result === 'damage_player') {
        e.takeDamage(999);
        this.systems.createExplosion(e.mesh.position, 0xff0000, true);
        this.takePlayerDamage(15);
      } else if (result === 'damage_crystal') {
        const target = e.target;
        if (target && target.userData.health !== undefined) {
          target.userData.health -= e.damage * delta * 3.0; // Increased damage to make it visible/threatening

          // Dynamic Warning & Sound
          if (!this.lastAlertTime || (this.audio.audioCtx && this.audio.audioCtx.currentTime - this.lastAlertTime > 2.0)) {
            this.lastAlertTime = this.audio.audioCtx ? this.audio.audioCtx.currentTime : Date.now();
            this.audio.playAlert();

            // Direction Calculation
            let dirText = "";
            if (target.position) {
              const toTarget = new THREE.Vector3().subVectors(target.position, this.camera.position).normalize();
              const forward = new THREE.Vector3();
              this.camera.getWorldDirection(forward);
              forward.y = 0; toTarget.y = 0; forward.normalize(); toTarget.normalize();

              const dot = forward.dot(toTarget);
              const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
              const dotRight = right.dot(toTarget);

              if (dot < -0.5) dirText = "(BEHIND)";
              else if (dotRight > 0.5) dirText = "(RIGHT)";
              else if (dotRight < -0.5) dirText = "(LEFT)";
              else dirText = "(AHEAD)";
            }

            const name = target.userData.name || "SYSTEM";
            this.ui.showWarning(`${name} ${dirText} UNDER ATTACK!`);

            // SWARM MECHANIC
            this.swarmCrystal(target);
          }

          if (target.userData.health <= 0) {
            target.visible = false; // Destroyed
            this.score = Math.max(0, this.score - 500);
            this.ui.showWarning(`DATA NODE LOST! -500 PTS`);
            this.ui.updateHUD(); // Ensure score updates
          }
        }
        // Throttled Visuals: 5% chance per frame, small explosion
        if (Math.random() < 0.05) {
          this.systems.createExplosion(e.mesh.position, 0x00ffff, false);
        }
      }

      if (!e.active) {
        if (e.life <= 0) this.systems.spawnDrop(e.mesh.position, this.wave);
        this.enemies.splice(i, 1);
      }
    }
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const result = this.boss.update(delta, this.camera.position);
    if (result === 'damage_player_boss') this.takePlayerDamage(50 * delta);

    const bar = document.getElementById('boss-health-bar');
    if (bar) {
      const pct = (this.boss.life / this.boss.maxLife) * 100;
      bar.style.width = pct + '%';
    }

    if (!this.boss.active) {
      const bossHud = document.getElementById('boss-health-container');
      if (bossHud) bossHud.remove();
      this.systems.createExplosion(this.boss.mesh.position, 0xffaa00, true, 5.0);
      this.score += 5000;
      this.boss = null;
      if (this.audio) this.audio.playBossDeath();
      setTimeout(() => this.triggerWin(), 2000);
    }
  }

  takePlayerDamage(amount) {
    this.playerHealth -= amount;
    if (Math.random() < 0.1) this.audio.playSound(80, 'square', 0.1, 0.2);
    if (this.ui.hud && Math.random() < 0.3) {
      const flash = document.createElement('div');
      flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:red;opacity:0.3;pointer-events:none;z-index:4500;";
      this.ui.hud.appendChild(flash);
      setTimeout(() => flash.remove(), 100);
    }
    if (this.playerHealth <= 0) this.triggerGameOver();
    this.ui.updateHUD();
  }

  shoot(e) {
    if (!this.active || this.isGameOver) return;
    const w = this.weapons[this.currentWeaponIdx];

    // Auto weapons (PLASMA) are handled in the update loop if mouse is held down.
    // Semi-auto weapons (BLASTER, SHOTGUN, LAUNCHER, BFG 9000) fire immediately on mousedown.
    // This `shoot` method is called on mousedown.
    // If the current weapon is PLASMA, we only want to fire it if it's explicitly triggered,
    // not just on a mousedown event if it's meant to be auto-fired in update.
    // However, the instruction is to remove exclusion for BLASTER, implying BLASTER should always fire here.
    // Since BLASTER is not PLASMA, it will proceed.
    // The original code already handles all weapons firing on mousedown unless specific conditions are met.
    // The provided edit snippet seems to be a misunderstanding or an attempt to add logic that's already implicitly there
    // or would cause infinite recursion.
    // The most faithful interpretation of "Remove the exclusion for BLASTER" is to ensure no specific check prevents BLASTER from firing.
    // The current code does not have such an exclusion.
    // Assuming the user intended to remove a conditional block that might have been present before,
    // or to ensure BLASTER is treated as semi-auto, which it already is by default.

    if (w.ammo !== -1 && w.ammo <= 0) {
      if (this.audio) this.audio.playSound(200, 'sine', 0.05, 0.1);
      return;
    }

    const now = Date.now();
    if (now - w.lastShot < w.cooldown) return;
    w.lastShot = now;

    if (w.ammo !== -1) w.ammo--;
    this.ui.updateHUD();

    this.weaponRecoil = 0.2;
    if (this.muzzleLight) {
      this.muzzleLight.intensity = 5;
      this.muzzleFlashTimer = 0.05; // 50ms flash
    }

    try {
      if (this.audio) this.audio.playWeaponSound(w.name);
    } catch (err) { console.error("Audio Error:", err); }

    if (w.type === 'hitscan') this.fireHitscan(w);
    else if (w.type === 'spread') {
      this.fireHitscan(w, 0);
      for (let i = 0; i < 24; i++) this.fireHitscan(w, 0.35); // Super Wide spread (Point Blank Only)
    }
    else if (w.type === 'projectile' || w.type === 'projectile_fast') this.fireProjectile(w);
    else if (w.type === 'bfg') this.fireBFG(w);
  }

  fireHitscan(weapon, spread = 0) {
    const coords = new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
    this.raycaster.setFromCamera(coords, this.camera);

    // Calculate a point far down the ray for the "miss" tracer
    const maxDist = (weapon.name === 'SHOTGUN') ? 100.0 : 500.0; // Fixed Shotgun Range (Was 40)
    const rayTarget = new THREE.Vector3();
    this.raycaster.ray.at(maxDist, rayTarget);

    // OPTIMIZED: Raycast only against simplified hitboxes to prevent CPU lag
    const objects = this.enemies.map(e => e.hitbox).filter(h => h);

    // Boss fallback
    if (this.boss) objects.push(this.boss.mesh);

    // Filter to ensure no undefineds
    const validObjects = objects.filter(o => o);

    // use recursive=true ONLY for boss (who is a Group without a singular hitbox yet)
    // For enemies, the hitbox is a simple Mesh, so recursion is cheap/unnecessary but harmless
    this.raycaster.far = maxDist; // Apply limit to raycaster
    const intersections = this.raycaster.intersectObjects(validObjects, true);
    this.raycaster.far = Infinity; // Reset for others
    let hitPoint = null;
    let target = null;

    if (intersections.length > 0) {
      const hit = intersections[0];
      hitPoint = hit.point;
      target = hit.object;
    }

    // VISUALS FIRST: Guaranteed Tracer
    const visualTarget = hitPoint || rayTarget;
    this.createTracer(visualTarget, weapon.color);

    // LOGIC SECOND: Damage & Explosions (Safely Wrapped)
    if (hitPoint && target) {
      try {
        // Find enemy from hitbox reference
        let enemy = null;

        // 1. Direct Hitbox Reference (Smartest way)
        if (target.userData && target.userData.enemy) {
          enemy = target.userData.enemy;
        }
        // 2. Boss Fallback
        else if (this.boss) {
          let curr = target;
          while (curr && curr !== this.scene) {
            if (curr === this.boss.mesh) { enemy = this.boss; break; }
            curr = curr.parent;
          }
        }

        if (enemy) {
          this.systems.createExplosion(hitPoint, 0x00ff00, false);
          // Pass 'target' (the specific mesh hit) to takeDamage for Weak Point detection
          if (enemy.takeDamage(weapon.damage, target)) {
            this.score += 100;
            if (enemy.isBoss) {
              // Boss damage logic handled in updateBoss
            }
            this.ui.updateHUD();
            this.systems.createExplosion(enemy.mesh.position, 0xff0000, true);
          }
        } else {
          // Hit something else (Wall? Floor?) - Spwan generic spark
          this.systems.createExplosion(hitPoint, 0xffff00, false);
        }
      } catch (err) {
        console.error("Hit Logic Error:", err);
      }
    }
  }

  fireProjectile(weapon) {
    // 1. Determine Spawn Point (Muzzle)
    const start = new THREE.Vector3();
    if (this.muzzleLight) this.muzzleLight.getWorldPosition(start);
    else {
      this.camera.getWorldPosition(start);
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      start.add(dir.multiplyScalar(1.0));
    }

    // 2. SMART CONVERGENCE: Raycast from Camera to find what we are actually looking at
    // This handles the "Bore Offset" issue perfectly at all ranges.
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // Get hit candidates (Enemies + Boss + Arena Walls/Floor if we had them)
    // Since we don't have physical walls in a separate array, we'll raycast against enemies first
    // and default to a long-distance point if no hit.
    const objects = this.enemies.map(e => e.hitbox).filter(h => h);
    if (this.boss) objects.push(this.boss.mesh);

    // OPTIONAL: Add a virtual "Floor" plane for aiming if looking down? 
    // For now, simpler is better: Raycast enemies, else project 100u.

    let targetPoint = new THREE.Vector3();
    const hits = this.raycaster.intersectObjects(objects, true);

    if (hits.length > 0) {
      // We are looking AT an enemy - Shoot AT them
      targetPoint.copy(hits[0].point);
    } else {
      // We are looking into the void - Shoot at virtual reticle distance (100u)
      // Check for Floor intent? If camera pitch is down?
      // Let's stick to the reliable 100u projection as the "Iron Sights" zero.
      this.raycaster.ray.at(100, targetPoint);

      // CORRECTION: If looking at floor, aim at floor intersection
      // The floor is y=0. Camera is y=10.
      // If ray.y direction is negative...
      if (this.raycaster.ray.direction.y < -0.05) {
        const t = (0 - this.raycaster.ray.origin.y) / this.raycaster.ray.direction.y;
        if (t > 0 && t < 200) {
          this.raycaster.ray.at(t, targetPoint);
        }
      }
    }

    // 3. Calculate Velocity Vector (Muzzle -> Target)
    const velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();

    const geo = new THREE.IcosahedronGeometry(weapon.type === 'projectile_fast' ? 0.2 : 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: weapon.color, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: velocityDir.multiplyScalar(weapon.type === 'projectile_fast' ? 300 : 80),
      life: 5.0, 
      damage: weapon.damage,
      isRocket: weapon.name === 'LAUNCHER',
      isPlasma: weapon.name === 'PLASMA'
    });
  }

  fireBFG(weapon) {
    const start = new THREE.Vector3();
    if (this.muzzleLight) this.muzzleLight.getWorldPosition(start);
    else this.camera.getWorldPosition(start);

    // BFG Smart Aim (Reuse same logic simplified)
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const targetPoint = new THREE.Vector3();
    this.raycaster.ray.at(100, targetPoint);
    const velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();

    const geo = new THREE.SphereGeometry(1.5, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({ mesh, velocity: velocityDir.multiplyScalar(30), life: 10.0, damage: weapon.damage, isBFG: true });
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      p.life -= delta;

      if (p.isBFG) {
        this.enemies.forEach(e => {
          if (e.mesh.position.distanceTo(p.mesh.position) < 30.0) {
            e.takeDamage(100 * delta);
            if (Math.random() < 0.2) this.createTracer(e.mesh.position, 0x00ff00, p.mesh.position);
          }
        });
        if (this.boss && this.boss.mesh.position.distanceTo(p.mesh.position) < 30.0) this.boss.takeDamage(100 * delta);
      }

      let hit = false;
      if (p.isEnemy) {
        if (p.mesh.position.distanceTo(this.camera.position) < 3.0) {
          hit = true;
          this.takePlayerDamage(p.damage);
          this.systems.createExplosion(this.camera.position, 0xff0000, true);
        }
        if (!hit) {
          for (const c of this.ui.crystals) {
            if (c.mesh && c.mesh.visible && c.mesh.userData.health > 0) {
              if (p.mesh.position.distanceTo(c.mesh.position) < 8.0) {
                hit = true;
                c.mesh.userData.health -= p.damage;
                this.systems.createExplosion(c.mesh.position, 0x00ffff, true);
                break;
              }
            }
          }
        }
      } else {
        // PLAYER PROJECTILE HIT LOGIC
        for (const e of this.enemies) {
          // Use Sphere Hitbox
          const dist = p.mesh.position.distanceTo(e.mesh.position);
          // Scale-relative hit radius
          const hitRadius = (e.scale / 2) + 1.0;
          if (dist < hitRadius) {
            hit = true;
            e.takeDamage(p.damage);
            break;
          }
        }
        if (this.boss && p.mesh.position.distanceTo(this.boss.mesh.position) < 10.0) {
          hit = true;
          this.boss.takeDamage(p.damage);
        }
      }

      // Rocket Floor & Wall Collision
      if (p.isRocket) {
        if (p.mesh.position.y < 0.5) {
          hit = true;
          console.log("DEBUG: Rocket hit floor", p.mesh.position);
          p.mesh.position.y = 0.5;
        }
        // Wall checks (Dynamic Rect)
        const b = this.arena.bounds;
        if (b) {
          if (p.mesh.position.x < b.minX || p.mesh.position.x > b.maxX ||
            p.mesh.position.z < b.minZ || p.mesh.position.z > b.maxZ) {
            hit = true;
            console.log("DEBUG: Rocket hit wall", p.mesh.position);
          }
        }
      }

      if (hit || p.life <= 0) {
        if (p.isRocket || p.isBFG) {
          const isBFG = p.isBFG;
          console.log("DEBUG: Creating Explosion for Rocket/BFG", { isBFG, pos: p.mesh.position });
          this.systems.createExplosion(p.mesh.position, p.mesh.material.color, true, isBFG ? 3.0 : 1.5);

          // Sound
          if (this.audio) this.audio.playNoise(0.5, 0.5, 0.5);

          // SPLASH DAMAGE LOGIC
          const radius = isBFG ? 60.0 : 40.0; // Reduced Rocket Radius slightly to match visual closer
          const dmg = isBFG ? 500 : 150;

          let hitCount = 0;
          this.enemies.forEach(e => {
            if (e.mesh.position.distanceTo(p.mesh.position) < radius) {
              e.takeDamage(dmg);
              hitCount++;
            }
          });
          console.log(`DEBUG: Splash hit ${hitCount} enemies`);

          if (this.boss && this.boss.mesh.position.distanceTo(p.mesh.position) < radius) this.boss.takeDamage(dmg);
        } else {
          // Normal impact (Plasma)
          this.systems.createExplosion(p.mesh.position, p.mesh.material.color, false);
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  createTracer(targetPoint, color, startPoint = null) {
    // Lazy init shared resources
    if (!this.sharedTracerGeo) this.sharedTracerGeo = new THREE.BoxGeometry(1, 1, 1);
    if (!this.sharedTracerMats) this.sharedTracerMats = {};
    if (!this.sharedTracerMats[color]) this.sharedTracerMats[color] = new THREE.MeshBasicMaterial({ color: color });

    const target = targetPoint;
    let start = new THREE.Vector3();

    if (startPoint) {
      start.copy(startPoint);
    } else if (this.muzzleLight) {
      // Preferred: Use the actual Muzzle Position
      this.muzzleLight.getWorldPosition(start);
    } else {
    // Fallback: Use Camera World Position + Relative Offset
      const offset = new THREE.Vector3(0.2, -0.2, -0.5); // Right, Down, Forward
      offset.applyQuaternion(this.camera.quaternion);
      start = this.camera.position.clone().add(offset);
    }
    const dist = start.distanceTo(target);

    // Reuse shared geometry and scale it
    const mesh = new THREE.Mesh(this.sharedTracerGeo, this.sharedTracerMats[color]);

    // Scale: thickness 0.1, length 'dist'
    // BoxGeometry(1,1,1) -> Scale(0.1, 0.1, dist) -> Size(0.1, 0.1, dist)
    mesh.scale.set(0.1, 0.1, dist);

    mesh.position.copy(start).lerp(target, 0.5);
    mesh.lookAt(target);
    this.scene.add(mesh);

    // Life 0.5s, isTracer=true
    this.systems.particles.push({ mesh, velocities: [], life: 0.5, initialLife: 0.5, isTracer: true });
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.ui.triggerGameOver(() => this.resetGame());
    this.audio.playSound(100, 'sawtooth', 2.0, 1.0);
  }

  triggerWin() {
    this.isVictory = true;
    this.ui.triggerWin(this.score, () => this.resetGame());
  }

  resetGame() {
    this.cleanupLevel();
    // Re-start game logic without toggling 'active' state to avoid ArchiveManager interference
    this.startGame();
    document.body.requestPointerLock();
  }

  handleKeys(e) {
    if (this.isVictory) {
      if (e.key === 'Enter') this.resetGame();
      if (e.key === 'Escape') this.deactivate();
      return;
    }
    if (e.key === 'r') this.resetGame();
    if (e.key === '0') {
      console.log("DEBUG: Jumping to Boss Wave & Refilling Ammo");
      // Refill Ammo
      this.weapons.forEach(w => w.ammo = w.maxAmmo);
      this.ui.updateHUD();

      // Clear current wave intervals
      if (this.spawnInterval) clearInterval(this.spawnInterval);
      if (this.pickupInterval) clearInterval(this.pickupInterval);
      // Clear existing enemies
      this.enemies.forEach(en => this.scene.remove(en.mesh));
      this.enemies = [];
      this.startBossWave();
      return;
    }
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < this.weapons.length) {
      this.currentWeaponIdx = idx;
      this.updateWeaponVisuals();
      this.ui.updateHUD();
    }
  }

  handlePointerLockChange() {
    if (!document.pointerLockElement && this.active && !this.isGameOver) this.deactivate();
  }




  gameOver() {
    this.isGameOver = true;
    this.active = false;
    this.scene.remove(this.arenaMesh);

    // Restore Grid
    this.scene.traverse(obj => {
      if (obj.type === 'GridHelper') obj.visible = true;
    });

    if (this.ui.hud) {
      if (this.ui.hud.parentNode) this.ui.hud.parentNode.removeChild(this.ui.hud);
    }
  }

  createWeaponMesh() {
    if (this.weaponMesh) this.camera.remove(this.weaponMesh);
    this.weaponMesh = new THREE.Group();
    this.weaponMesh.position.set(0.0, -0.3, -0.6);
    this.camera.add(this.weaponMesh);

    // Muzzle
    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 5);
    this.muzzleLight.position.set(0, 0, -1.0);
    this.weaponMesh.add(this.muzzleLight);

    // 1. Blaster Mesh (Legacy: Box, Green, Wireframe)
    this.blasterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.3, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x33ff33, wireframe: true })
    );
    this.weaponMesh.add(this.blasterMesh);

    // 2. Shotgun Mesh (Legacy: Double Barrel, Orange, SOLID)
    this.shotgunMesh = new THREE.Group();
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.1, 0, 0);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.1, 0, 0);
    this.shotgunMesh.add(barrelL, barrelR);
    this.weaponMesh.add(this.shotgunMesh);

    // 3. Launcher Mesh (Legacy: Cylinder, Red, Wireframe)
    this.launcherMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.0, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    );
    this.launcherMesh.rotation.x = Math.PI / 2;
    this.weaponMesh.add(this.launcherMesh);

    // 4. Plasma Rifle
    this.plasmaMesh = new THREE.Group();
    const pMain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pMain.rotation.x = Math.PI / 2;
    const pCoil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pCoil.position.z = -0.2;
    this.plasmaMesh.add(pMain, pCoil);
    this.weaponMesh.add(this.plasmaMesh);

    // 5. BFG 9000
    this.bfgMesh = new THREE.Group();
    const bCore = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    const bBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 1.0, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    bBarrel.rotation.x = Math.PI / 2;
    this.bfgMesh.add(bCore, bBarrel);
    this.weaponMesh.add(this.bfgMesh);

    this.updateWeaponVisuals();
  }

  updateWeaponVisuals() {
    if (!this.weaponMesh) return;
    const w = this.weapons[this.currentWeaponIdx];
    this.blasterMesh.visible = (w.name === "BLASTER");
    this.shotgunMesh.visible = (w.name === "SHOTGUN");
    this.launcherMesh.visible = (w.name === "LAUNCHER");
    this.plasmaMesh.visible = (w.name === "PLASMA");
    this.bfgMesh.visible = (w.name === "BFG 9000");
    this.muzzleLight.color.setHex(w.color);
  }

  updateWeaponRecoil(delta) {
    if (this.muzzleLight && this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) this.muzzleLight.intensity = 0;
    }

    if (this.isFiring) {
      const wName = this.weapons[this.currentWeaponIdx].name;
      // Auto-fire weapons
      if (wName === 'PLASMA') this.shoot();
    }

    if (this.weaponMesh && this.weaponRecoil > 0) {
      this.weaponMesh.position.z += this.weaponRecoil * delta * 5;
      this.weaponRecoil -= delta * 2;
      this.weaponRecoil = Math.max(0, this.weaponRecoil);
      this.weaponMesh.position.z = Math.min(-0.6 + this.weaponRecoil, -0.4);
    }
  }

  startPickups() {
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    this.pickupInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      this.systems.spawnHealthPickup(this.camera.position);
    }, 15000);
  }

  swarmCrystal(crystalMesh) {
    // Force nearby enemies to switch target to this crystal
    if (!crystalMesh) return;
    let count = 0;
    for (const enemy of this.enemies) {
      if (enemy.target === crystalMesh) continue; // Already targeting
      if (enemy.isWraith) continue; // Wraiths do what they want

      const distSq = enemy.mesh.position.distanceToSquared(crystalMesh.position);
      if (distSq < 6400) { // 80 units
        // 50% chance to join the swarm if close
        if (Math.random() < 0.5) {
          enemy.target = crystalMesh;
          enemy.role = 'destroyer'; // Enforce crystal focus
          count++;
        }
      }
    }
    if (count > 0) console.log(`DEBUG: Swarm Triggered! ${count} enemies diverted to crystal.`);
  }
}
