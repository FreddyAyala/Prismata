import * as THREE from 'three';
import { DoomAudio } from './DoomAudio.js';
import { GlitchEnemy } from './DoomEnemy.js';
import { GlitchBoss } from './DoomBoss.js';
import { WEAPONS } from './DoomWeapons.js';
import { DoomUI } from './DoomUI.js';
import { DoomSystems } from './DoomSystems.js';
import { DoomArena } from './DoomArena.js';
import { DoomProjectiles } from './DoomProjectiles.js';

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
    this.projectiles = new DoomProjectiles(this); // New Module

    // Game State
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;
    this.enemies = [];
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

    // Cheats
    this.cheatBuffer = "";
    this.godMode = false;
  }

  activate(exhibits = null, skipIntro = false) {
    if (this.active) return;
    console.log("🛡️ DOOM GAME ACTIVATED - V6 (MODULAR)");
    this.active = true;

    this.ui.createHUD();
    this.exhibitsSource = exhibits || [];

    this.setupInputs();

    if (!skipIntro) {
      console.log("DEBUG: Showing Instructions...");
      this.ui.showInstructions(() => {
        this.startGame();
        document.body.requestPointerLock();
      });
    } else {
      this.startGame();
      document.body.requestPointerLock();
    }

    if (this.audio && this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();
  }

  startGame() {
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

    this.arena.create(this.exhibitsSource);

    this.exhibitsSource.forEach(ex => {
      if (ex.mesh) {
        ex.mesh.userData.health = 100;
        ex.mesh.userData.name = ex.title || "DATA NODE";
      }
    });

    this.createWeaponMesh();
    this.ui.initModelHealthBars(this.exhibitsSource);

    if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();
    if (this.audio) {
      this.musicHandle = this.audio.playMusic(() => this.active && !this.isGameOver);
    }

    this.startWave();
    this.startPickups();
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
    if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();

    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    if (this.boss) { this.scene.remove(this.boss.mesh); this.boss = null; }

    this.projectiles.clear();
  }

  update(delta) {
    if (!this.active) return;

    this.systems.updateParticles(delta);
    this.checkCrystalHealth();

    if (this.isVictory || this.isGameOver) return;
    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') this.audio.audioCtx.resume();

    this.arena.constrainCamera(this.camera);

    if (this.waveInProgress && this.enemiesToSpawn === 0 && this.enemies.length === 0 && !this.boss) {
      this.waveInProgress = false;
      this.wave++;
      this.audio.playSound(600, 'sine', 1.0, 0.5);
      if (this.audio.setMusicPhase) this.audio.setMusicPhase(0);
      setTimeout(() => this.startWave(), 3000);
    }

    this.ui.updateModelHealthBars();

    this.updateEnemies(delta);
    if (this.boss) {
      try {
        const res = this.boss.update(delta, this.camera.position);
        if (this.ui.updateBossHealth) this.ui.updateBossHealth(this.boss.life, this.boss.maxLife);

        if (res === 'remove') {
          this.scene.remove(this.boss.mesh);
          this.boss = null;
          this.triggerWin();
        }
      } catch (e) {
        console.error("BOSS UPDATE CRASH:", e);
      }
    }

    this.projectiles.update(delta);

    this.systems.updateParticles(delta);
    this.systems.updatePickups(delta, this.camera.position, (type) => this.onPickup(type));
    this.updateWeaponRecoil(delta);
  }

  onPickup(type) {
    if (type === 'health') {
      this.playerHealth = Math.min(100, this.playerHealth + 50);
    } else {
      const ammoMap = { 'ammo_shotgun': ['SHOTGUN', 8], 'ammo_launcher': ['LAUNCHER', 4], 'ammo_plasma': ['PLASMA', 40], 'ammo_bfg': ['BIG FREAKING GEMINI', 1] };
      if (ammoMap[type]) {
        const [name, amount] = ammoMap[type];
        const w = this.weapons.find(x => x.name === name);
        if (w) w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
      }
    }
    if (this.audio && this.audio.playPickup) this.audio.playPickup();
    else if (this.audio) this.audio.playSound(400, 'sine', 0.1, 0.2);
    this.ui.updateHUD();
  }

  startWave() {
    if (this.spawnInterval) clearInterval(this.spawnInterval);

    if (this.wave === 5) { this.startBossWave(); return; }
    if (this.wave > 5) { this.triggerWin(); return; }

    this.waveInProgress = true;
    this.enemiesToSpawn = 15 + (this.wave * 8);
    const spawnRate = Math.max(300, 2500 - (this.wave * 300));

    this.ui.showWaveTitle(`WAVE ${this.wave}`);
    if (this.audio.setMusicPhase) this.audio.setMusicPhase(this.wave === 1 ? 1 : 2);

    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.enemiesToSpawn > 0 && this.enemies.length < 30) {
        this.spawnEnemy();
      }
    }, spawnRate);

    this.ui.updateHUD();
  }

  startBossWave() {
    this.waveInProgress = true;
    this.wave = 5;
    this.ui.showWaveTitle("THE AI BUBBLE: POP IT TO SAVE AI!");
    if (this.audio.setMusicPhase) this.audio.setMusicPhase(3);
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, 5, -60));

    const onShoot = (pos, dir, type) => this.projectiles.fireEnemyProjectile(pos, dir, type);
    this.boss = new GlitchBoss(this.scene, spawnPos, this.camera, onShoot);

    setTimeout(() => {
      this.ui.showWarning("AIM FOR THE GPUS! THEY'RE OVERHEATING!");
      this.audio.playSound(100, 'square', 1.0, 1.0);
    }, 4000);

    this.enemiesToSpawn = 50;
    const spawnRate = 3000;
    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.boss && this.enemies.length < 8) {
        this.spawnEnemy();
      }
    }, spawnRate);
  }

  spawnEnemy() {
    if (!this.active) return;
    const validTargets = this.ui.crystals.filter(c => c.mesh && c.mesh.visible && c.mesh.userData.health > 0).map(c => c.mesh);

    let spawnPoint = this.arena.getRandomSpawnPoint();
    for (let i = 0; i < 5; i++) {
      const potential = this.arena.getRandomSpawnPoint();
      const dist = potential.distanceTo(this.camera.position);
      if (dist > 20 && dist < 110) {
        spawnPoint = potential;
        break;
      }
    }

    let target = this.camera;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const role = Math.random() < 0.6 ? 'destroyer' : 'hunter';

    if (validTargets.length > 0) {
      if (role === 'destroyer') target = pick(validTargets);
      else target = pick(validTargets);
    }

    let type = 'normal';
    if (this.wave > 1 && Math.random() < 0.3) type = 'imp';
    if (this.wave > 2 && Math.random() < 0.2) type = 'wraith';
    if (this.wave > 3 && Math.random() < 0.15) type = 'tank';
    if (this.wave > 4 && Math.random() < 0.1) type = 'berzerker';
    if (this.wave > 2 && Math.random() < 0.1) type = 'scout';

    const onFindTarget = (pos) => this.findNearestCrystal(pos);
    const enemy = new GlitchEnemy(this.scene, spawnPoint, target, type, role, (pos, dir, enemyType) => {
      this.projectiles.fireEnemyProjectile(pos, dir, enemyType);
    }, onFindTarget);
    this.enemies.push(enemy);
    this.enemiesToSpawn--;
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
          target.userData.health -= e.damage * delta * 3.0;
          if (!this.lastAlertTime || (this.audio.audioCtx && this.audio.audioCtx.currentTime - this.lastAlertTime > 2.0)) {
            this.lastAlertTime = this.audio.audioCtx ? this.audio.audioCtx.currentTime : Date.now();
            this.audio.playAlert();

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
            this.swarmCrystal(target);
          }
          if (target.userData.health <= 0) {
            this.destroyCrystal(target);
          }
        }
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
    if (this.godMode) return;
    this.playerHealth -= amount;
    if (Math.random() < 0.1) this.audio.playSound(80, 'square', 0.1, 0.2);
    if (this.ui.hud && Math.random() < 0.3) {
      const flash = document.createElement('div');
      flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:red;opacity:0.3;pointer-events:none;z-index:4500;";
      this.ui.hud.appendChild(flash);
      setTimeout(() => flash.remove(), 100);
    }
    if (this.audio && this.audio.playPlayerPain) this.audio.playPlayerPain();
    if (this.playerHealth <= 0) this.triggerGameOver();
    this.ui.updateHUD();
  }

  shoot(e) {
    if (!this.active || this.isGameOver) return;
    const w = this.weapons[this.currentWeaponIdx];

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
      this.muzzleFlashTimer = 0.05;
    }
    if (this.audio) this.audio.playWeaponSound(w.name);

    if (w.type === 'hitscan') this.projectiles.fireHitscan(w);
    else if (w.type === 'spread') {
      this.projectiles.fireHitscan(w, 0);
      for (let i = 0; i < 24; i++) this.projectiles.fireHitscan(w, 0.35);
    }
    else if (w.type === 'projectile' || w.type === 'projectile_fast') this.projectiles.fireProjectile(w);
    else if (w.type === 'bfg') this.projectiles.fireBFG(w);
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.ui.triggerGameOver(() => this.resetGame());
    this.audio.playSound(100, 'sawtooth', 2.0, 1.0);
  }

  triggerWin() {
    this.isVictory = true;
    if (this.audio && this.audio.playVictorySong) this.audio.playVictorySong();
    this.ui.triggerWin(this.score, () => this.resetGame());
  }

  resetGame() {
    if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();
    this.cleanupLevel();
    this.startGame();
    document.body.requestPointerLock();
  }

  handleKeys(e) {
    if (this.isVictory) {
      if (e.key === 'Enter') this.resetGame();
      if (e.key === 'Escape') this.deactivate();
      return;
    }
    this.handleCheatInput(e.key);
    if (e.key === 'r') this.resetGame();
    if (e.key === '0') {
      console.log("DEBUG: Jumping to Boss Wave & Refilling Ammo");
      this.weapons.forEach(w => w.ammo = w.maxAmmo);
      this.ui.updateHUD();

      if (this.spawnInterval) clearInterval(this.spawnInterval);
      if (this.pickupInterval) clearInterval(this.pickupInterval);
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

  handleCheatInput(key) {
    this.cheatBuffer += key.toLowerCase();
    if (this.cheatBuffer.length > 10) this.cheatBuffer = this.cheatBuffer.slice(-10);

    if (this.cheatBuffer.endsWith("iddqd")) {
      this.godMode = !this.godMode;
      this.playerHealth = 100;
      this.ui.showWarning(this.godMode ? "GOD MODE ON" : "GOD MODE OFF");
      this.audio.playSound(1000, 'sawtooth', 0.5, 0.5); 
      this.ui.updateHUD();
    }
    else if (this.cheatBuffer.endsWith("idkfa")) {
      this.weapons.forEach(w => w.ammo = w.maxAmmo);
      this.weapons[0].ammo = -1; 
      this.ui.showWarning("VERY HAPPY AMMO ADDED");
      this.audio.playSound(800, 'square', 0.5, 0.5);
      this.ui.updateHUD();
    }
    else if (this.cheatBuffer.endsWith("idclev5")) {
      this.ui.showWarning("WARPING TO BOSS...");
      setTimeout(() => this.startBossWave(), 1000);
    }
  }

  handlePointerLockChange() {
    if (!document.pointerLockElement && this.active && !this.isGameOver && !this.isVictory) this.deactivate();
  }

  gameOver() {
    this.isGameOver = true;
    this.active = false;
    this.scene.remove(this.arenaMesh);

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

    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 5);
    this.muzzleLight.position.set(0, 0, -1.0);
    this.weaponMesh.add(this.muzzleLight);

    this.blasterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.3, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x33ff33, wireframe: true })
    );
    this.weaponMesh.add(this.blasterMesh);

    this.shotgunMesh = new THREE.Group();
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.1, 0, 0);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.1, 0, 0);
    this.shotgunMesh.add(barrelL, barrelR);
    this.weaponMesh.add(this.shotgunMesh);

    this.launcherMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.0, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    );
    this.launcherMesh.rotation.x = Math.PI / 2;
    this.weaponMesh.add(this.launcherMesh);

    this.plasmaMesh = new THREE.Group();
    const pMain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pMain.rotation.x = Math.PI / 2;
    const pCoil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pCoil.position.z = -0.2;
    this.plasmaMesh.add(pMain, pCoil);
    this.weaponMesh.add(this.plasmaMesh);

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
    this.bfgMesh.visible = (w.name === "BIG FREAKING GEMINI");
    this.muzzleLight.color.setHex(w.color);
  }

  updateWeaponRecoil(delta) {
    if (this.muzzleLight && this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      if (this.muzzleFlashTimer <= 0) this.muzzleLight.intensity = 0;
    }
    if (this.isFiring) {
      const wName = this.weapons[this.currentWeaponIdx].name;
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
    if (!crystalMesh) return;
    for (const enemy of this.enemies) {
      if (enemy.target === crystalMesh) continue;
      const distSq = enemy.mesh.position.distanceToSquared(crystalMesh.position);
      if (distSq < 22500) {
        enemy.target = crystalMesh;
        enemy.role = 'destroyer';
        enemy.retaliationTimer = 0; 
      }
    }
  }

  checkCrystalHealth() {
    if (!this.ui || !this.ui.crystals) return;
    this.ui.crystals.forEach(c => {
      if (c.mesh && c.mesh.userData.health !== undefined && c.mesh.userData.health <= 0 && !c.mesh.userData.isDead) {
        this.destroyCrystal(c.mesh);
      }
    });
  }

  findNearestCrystal(pos) {
    if (!this.ui || !this.ui.crystals) return null;
    let closest = null;
    let minDist = Infinity;
    for (const c of this.ui.crystals) {
      if (!c.mesh || !c.mesh.visible || c.mesh.userData.isDead) continue;
      const d = pos.distanceToSquared(c.mesh.position);
      if (d < minDist) {
        minDist = d;
        closest = c.mesh;
      }
    }
    return closest;
  }

  destroyCrystal(crystalMesh) {
    if (!crystalMesh || crystalMesh.userData.isDead) return;
    console.log("CRITICAL: Crystal Destroyed", crystalMesh.userData.name);
    crystalMesh.userData.isDead = true;
    crystalMesh.visible = false;
    this.ui.score -= 1000;
    this.ui.updateHUD();
    if (this.ui.showWarning) this.ui.showWarning(`HISTORY LOST: ${crystalMesh.userData.name}`);
    this.systems.createExplosion(crystalMesh.position, 0xff0000, true, 20.0);
    if (this.audio) {
      this.audio.playSound(50, 'sawtooth', 3.0, 1.0);
      this.audio.playSound(200, 'square', 1.5, 0.8, -1200);
    }
    if (crystalMesh.parent) crystalMesh.parent.remove(crystalMesh);
    else this.scene.remove(crystalMesh);
    this.enemies.forEach(e => {
      if (e.target === crystalMesh) {
        e.target = null;
        if (e.findNewTarget) e.findNewTarget();
      }
    });
  }
}
