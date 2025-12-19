import * as THREE from 'three';
import { DoomAudio } from './DoomAudio.js';
import { GlitchEnemy } from './DoomEnemy.js';
import { GlitchBoss } from './DoomBoss.js';
import { WEAPONS } from './DoomWeapons.js';
import { DoomUI } from './DoomUI.js';
import { DoomSystems } from './DoomSystems.js';

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

    // Arena
    this.arenaSize = 200; // 400x400 - Safe Size covering everything
    this.arenaMesh = null;
  }

  activate(exhibits = null, skipIntro = false) {
    if (this.active) return;
    // alert("DOOM V5 DEBUG: UPDATED CODE LOADED"); // Force user attention
    console.log("🛡️ DOOM GAME ACTIVATED - V5 PURPLE");
    this.active = true;

    this.ui.createHUD();
    this.exhibitsSource = exhibits || [];

    // RESET WEAPONS & STATE
    this.weapons = WEAPONS.map(w => ({
      ...w,
      ammo: w.name === 'BLASTER' ? -1 : 0
    }));
    this.currentWeaponIdx = 0;
    this.playerHealth = 100;

    this.createArena(); // Build the Kill Box

    this.createWeaponMesh();
    this.ui.initModelHealthBars(this.exhibitsSource);

    // Input
    this.mousedownHandler = (e) => { this.isFiring = true; this.shoot(e); };
    this.mouseupHandler = () => { this.isFiring = false; };
    document.addEventListener('mousedown', this.mousedownHandler);
    document.addEventListener('mouseup', this.mouseupHandler);

    this.keyParams = { handler: (e) => this.handleKeys(e) };
    window.addEventListener('keydown', this.keyParams.handler);

    this.lockParams = { handler: () => this.handlePointerLockChange() };
    document.addEventListener('pointerlockchange', this.lockParams.handler);

    if (!skipIntro) {
      this.ui.showInstructions(() => this.resetGame());
    } else {
      document.body.requestPointerLock();
    }

    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') {
      this.audio.audioCtx.resume();
    }
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (document.pointerLockElement) document.exitPointerLock();

    // Cleanup
    if (this.weaponMesh) { this.camera.remove(this.weaponMesh); this.weaponMesh = null; }
    if (this.arenaMesh) { this.scene.remove(this.arenaMesh); this.arenaMesh = null; } // Cleanup Arena
    if (this.mousedownHandler) { document.removeEventListener('mousedown', this.mousedownHandler); this.mousedownHandler = null; }
    if (this.mouseupHandler) { document.removeEventListener('mouseup', this.mouseupHandler); this.mouseupHandler = null; }
    this.isFiring = false;

    if (this.keyParams) { window.removeEventListener('keydown', this.keyParams.handler); this.keyParams = null; }
    if (this.lockParams) {
      document.removeEventListener('pointerlockchange', this.lockParams.handler);
      this.lockParams = null;
    }

    if (this.spawnInterval) clearInterval(this.spawnInterval);
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    if (this.musicInterval) clearInterval(this.musicInterval);

    this.ui.removeHUD();
    this.systems.clear();

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
    if (this.camera) {
      const b = this.arenaBounds;
      const buffer = 2.0;
      if (b) {
        if (this.camera.position.x < b.minX + buffer) this.camera.position.x = b.minX + buffer;
        if (this.camera.position.x > b.maxX - buffer) this.camera.position.x = b.maxX - buffer;
        if (this.camera.position.z < b.minZ + buffer) this.camera.position.z = b.minZ + buffer;
        if (this.camera.position.z > b.maxZ - buffer) this.camera.position.z = b.maxZ - buffer;
      } else {
        // Fallback legacy
        const s = this.arenaSize - 2;
        if (this.camera.position.x < -s) this.camera.position.x = -s;
        if (this.camera.position.x > s) this.camera.position.x = s;
        if (this.camera.position.z < -s) this.camera.position.z = -s;
        if (this.camera.position.z > s) this.camera.position.z = s;
      }
      // Also keep above floor?
      if (this.camera.position.y < 2) this.camera.position.y = 2; // Floor is 0
    }

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
    this.ui.showWaveTitle("FINAL PROTOCOL: TITAN");
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, 10, -80));
    const onShoot = (pos, dir) => this.fireEnemyProjectile(pos, dir);
    this.boss = new GlitchBoss(this.scene, spawnPos, this.camera, onShoot);

    const bossHudContainer = document.createElement('div');
    bossHudContainer.id = 'boss-health-container';
    bossHudContainer.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); width:60%; height:30px; border:2px solid #ff0000; background: rgba(50,0,0,0.5);";
    bossHudContainer.innerHTML = `
        <div id="boss-health-bar" style="width:100%; height:100%; background:#ff4400; transition:width 0.2s;"></div>
        <div style="position:absolute; top:5px; left:50%; transform:translateX(-50%); font-size:16px; color:white; font-weight:bold;">TITAN: FINAL PROTOCOL</div>
    `;
    if (this.ui.hud) this.ui.hud.appendChild(bossHudContainer);

    this.enemiesToSpawn = 50;
    const spawnRate = 3000;
    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.boss && this.enemies.length < 5) {
        this.spawnEnemy();
      }
    }, spawnRate);
  }

  // NOTE: The createArena method is not present in the provided code snippet.
  // If it were, the wallHeight update would be applied there.
  createArena() {
    if (this.arenaMesh) this.scene.remove(this.arenaMesh);
    this.arenaMesh = new THREE.Group();

    // 1. WALLS ONLY - V8 (WIDTH 150 & REAL LENGTH)
    console.log("🚀 DOOM ARENA V8: WIDTH 150 & FIXED LENGTH");

    let minX = -75, maxX = 75; // WIDTH 150 (Huge)
    let maxZ = 25;
    let minZ = -250;

    this.scene.traverse(obj => {
      if (obj.type === 'GridHelper') obj.visible = false;
    });

    if (this.exhibitsSource && this.exhibitsSource.length > 0) {
      // FIX: Use e.position.z directly (ArchiveManager format)
      const zValues = this.exhibitsSource.map(e => e.position ? e.position.z : (e.mesh ? e.mesh.position.z : 0));
      const furthestZ = Math.min(...zValues);

      // Extend 100 units past for safety
      if (furthestZ < minZ) minZ = furthestZ - 100;
      console.log("📏 V8 LENGTH CALC -> Furthest:", furthestZ, "-> Arena MinZ:", minZ);
    } else {
      console.warn("⚠️ No exhibits found for Arena sizing (V8), using default.");
    }

    this.arenaBounds = { minX, maxX, minZ, maxZ };
    console.log("🏟️ ARENA BOUNDS:", this.arenaBounds);

    const width = maxX - minX;
    const depth = maxZ - minZ;

    // Add Grid Lines - PURPLE
    const gridGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff00ff, opacity: 0.8 }); // PURPLE & BRIGHT

    // Z-Lines (along depth)
    const step = 10;
    for (let x = minX; x <= maxX; x += step) {
      // Floor lines
      const pts = [new THREE.Vector3(x, 0.3, minZ), new THREE.Vector3(x, 0.3, maxZ)];
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    // X-Lines
    for (let z = minZ; z <= maxZ; z += step) {
      const pts = [new THREE.Vector3(minX, 0.3, z), new THREE.Vector3(maxX, 0.3, z)];
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    this.arenaMesh.add(gridGroup);

    // Add Walls (Visible semi-transparent walls)
    const wallHeight = 40; // Ensure Width 40
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xff00ff, // PURPLE
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    });

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Left Wall
    const wLeft = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallHeight), wallMat);
    wLeft.position.set(minX, wallHeight / 2, centerZ);
    wLeft.rotation.y = Math.PI / 2;
    this.arenaMesh.add(wLeft);

    // Right Wall
    const wRight = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallHeight), wallMat);
    wRight.position.set(maxX, wallHeight / 2, centerZ);
    wRight.rotation.y = Math.PI / 2;
    this.arenaMesh.add(wRight);

    // Front Wall
    const wFront = new THREE.Mesh(new THREE.PlaneGeometry(width, wallHeight), wallMat);
    wFront.position.set(centerX, wallHeight / 2, maxZ);
    this.arenaMesh.add(wFront);

    // Back Wall
    const wBack = new THREE.Mesh(new THREE.PlaneGeometry(width, wallHeight), wallMat);
    wBack.position.set(centerX, wallHeight / 2, minZ);
    this.arenaMesh.add(wBack);

    this.scene.add(this.arenaMesh);
  }

  spawnEnemy() {
    if (!this.active) return;
    const validTargets = this.ui.crystals.filter(c => c.mesh && c.mesh.visible && c.mesh.userData.health > 0).map(c => c.mesh);
    let target = this.camera;
    if (validTargets.length > 0 && Math.random() < 0.7) {
      target = validTargets[Math.floor(Math.random() * validTargets.length)];
    }

    let type = 'normal';
    const roll = Math.random();
    if (this.wave >= 1 && roll < 0.2) type = 'scout';
    if (this.wave >= 2 && roll < 0.15) type = 'tank';
    if (this.wave >= 2 && roll < 0.15 && roll >= 0.05) type = 'imp';
    if (this.wave >= 3 && roll < 0.15) type = 'berzerker';
    if (this.wave >= 3 && roll < 0.1) type = 'wraith';
    if (this.wave >= 4 && roll < 0.25) type = 'berzerker';

    // Spawn on perimeter of arena bounds
    let b = this.arenaBounds;
    if (!b) b = { minX: -20, maxX: 20, minZ: -200, maxZ: 20 }; // Fallback

    let spawnX, spawnZ;

    // Pick a side: 0=North, 1=South, 2=East, 3=West
    const side = Math.floor(Math.random() * 4);
    const buffer = 2; // spawn sightly inside? or outside? Inside to avoid clamping issues.

    if (side === 0) { // MinZ side (Far back)
      spawnZ = b.minZ - buffer;
      spawnX = b.minX + Math.random() * (b.maxX - b.minX);
    } else if (side === 1) { // MaxZ side (Front)
      spawnZ = b.maxZ + buffer;
      spawnX = b.minX + Math.random() * (b.maxX - b.minX);
    } else if (side === 2) { // MinX side (Left)
      spawnX = b.minX - buffer;
      spawnZ = b.minZ + Math.random() * (b.maxZ - b.minZ);
    } else { // MaxX side (Right)
      spawnX = b.maxX + buffer;
      spawnZ = b.minZ + Math.random() * (b.maxZ - b.minZ);
    }

    const onShoot = (pos, dir) => this.fireEnemyProjectile(pos, dir);
    const enemy = new GlitchEnemy(this.scene, new THREE.Vector3(spawnX, 4, spawnZ), target, type, onShoot);

    const multiplier = 1 + (this.wave - 1) * 0.15;
    enemy.life *= multiplier;
    this.enemies.push(enemy);
    if (this.wave !== 5) this.enemiesToSpawn--;
    this.ui.updateHUD();
  }

  fireEnemyProjectile(start, dir) {
    const geo = new THREE.DodecahedronGeometry(0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(30),
      life: 5.0,
      damage: 15,
      isEnemy: true
    });
    if (this.audio) this.audio.playSound(200, 'sawtooth', 0.2, 0.5);
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
        if (e.target) {
          e.target.userData.health -= 20;
          if (e.target.userData.health <= 0) e.target.visible = false;
        }
        e.takeDamage(999);
        this.systems.createExplosion(e.mesh.position, 0x00ffff, true);
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
          if (enemy.takeDamage(weapon.damage)) {
            this.score += 100;
            if (enemy.isBoss) this.score += 5000;
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
    const start = new THREE.Vector3();
    if (this.muzzleLight) this.muzzleLight.getWorldPosition(start);
    else {
      this.camera.getWorldPosition(start);
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      start.add(dir.multiplyScalar(1.0));
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const geo = new THREE.IcosahedronGeometry(weapon.type === 'projectile_fast' ? 0.2 : 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: weapon.color, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(weapon.type === 'projectile_fast' ? 300 : 80), // Doubled Plasma speed
      life: 5.0, // Effective range: 300 * 5 = 1500 units
      damage: weapon.damage,
      isRocket: weapon.name === 'LAUNCHER',
      isPlasma: weapon.name === 'PLASMA'
    });
  }

  fireBFG(weapon) {
    const start = new THREE.Vector3();
    if (this.muzzleLight) this.muzzleLight.getWorldPosition(start);
    else this.camera.getWorldPosition(start);

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const geo = new THREE.SphereGeometry(1.5, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({ mesh, velocity: dir.multiplyScalar(30), life: 10.0, damage: weapon.damage, isBFG: true });
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
        for (const e of this.enemies) {
          if (p.mesh.position.distanceTo(e.mesh.position) < (e.scale / 2 + 1)) {
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
          p.mesh.position.y = 0.5;
        }
        // Wall checks (Dynamic Rect)
        const b = this.arenaBounds;
        if (b) {
          if (p.mesh.position.x < b.minX || p.mesh.position.x > b.maxX ||
            p.mesh.position.z < b.minZ || p.mesh.position.z > b.maxZ) {
            hit = true;
          }
        } else if (Math.abs(p.mesh.position.x) > this.arenaSize - 1 || Math.abs(p.mesh.position.z) > this.arenaSize - 1) {
          hit = true;
        }
      }

      if (hit || p.life <= 0) {
        if (p.isRocket || p.isBFG) {
          const isBFG = p.isBFG;
          this.systems.createExplosion(p.mesh.position, p.mesh.material.color, true, isBFG ? 3.0 : 1.5);

          // Sound
          if (this.audio) this.audio.playNoise(0.5, 0.5, 0.5);

          const radius = isBFG ? 60.0 : 50.0; // MASSIVE Splash Radius
          const dmg = isBFG ? 500 : 150; // MASSIVE Damage
          this.enemies.forEach(e => { if (e.mesh.position.distanceTo(p.mesh.position) < radius) e.takeDamage(dmg); });
          if (this.boss && this.boss.mesh.position.distanceTo(p.mesh.position) < radius) this.boss.takeDamage(dmg);
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
    let start;
    if (startPoint) start = startPoint;
    else {
      // Use Camera World Position + Relative Offset
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
    this.ui.triggerWin(() => this.resetGame());
  }

  resetGame() {
    this.deactivate();
    this.activate(this.exhibitsSource, true);
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;
    this.isGameOver = false;
    this.startWave();
    this.startPickups();
    this.musicInterval = this.audio.playMusic(() => this.active && !this.isGameOver);
    document.body.requestPointerLock();
  }

  handleKeys(e) {
    if (e.key === 'r') this.resetGame();
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
    this.weaponMesh.position.set(0.3, -0.3, -0.6);
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
      this.systems.spawnHealthPickup(this.arenaSize);
    }, 15000);
  }
}
