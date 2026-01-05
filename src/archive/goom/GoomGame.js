import * as THREE from 'three';
import { GoomAudio } from './GoomAudio.js';
import { GlitchEnemy } from './GoomEnemy.js';
import { GlitchBoss } from './GoomBoss.js';
import { WEAPONS } from './GoomWeapons.js';
import { GoomUI } from './GoomUI.js';
import { GoomSystems } from './GoomSystems.js';
import { GoomArena } from './GoomArena.js';
import { GoomProjectiles } from './GoomProjectiles.js';

export class GoomGame {
  constructor(scene, camera, player = null) {
    this.scene = scene;
    this.scene.userData.game = this; // Expose Game to Objects (e.g. Boss)
    this.camera = camera;
    this.player = player;
    this.active = false;

    // Systems
    this.audio = new GoomAudio();
    // DEBUG: Allow user to change music from console
    window.setMusic = (p) => {
      if (this.audio && this.audio.setMusicPhase) {
        this.audio.setMusicPhase(p);
        console.log(`Command: Music set to Phase ${p}`);
      }
    };
    this.ui = new GoomUI(this);
    this.systems = new GoomSystems(this);
    this.arena = new GoomArena(scene);
    this.projectiles = new GoomProjectiles(this); // New Module

    // Game State
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;
    this.playerArmor = 0; // NEW: Armor State
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
    console.log("🛡️ GOOM GAME ACTIVATED - V6 (MODULAR)");
    this.active = true;

    // FOG OVERRIDE: Clearer view for combat
    if (this.scene.fog) {
      this.originalFogDensity = this.scene.fog.density;
      this.scene.fog.density = 0.002; // Much clearer (was 0.02)
    }

    // HIDE OVERLAPPING UI
    // HIDE OVERLAPPING UI
    const footer = document.querySelector('.gallery-footer');
    if (footer) footer.style.display = 'none';
    const dock = document.querySelector('.mobile-dock');
    if (dock) dock.style.display = 'none';
    const hint = document.querySelector('.interaction-hint');
    if (hint) {
      hint.style.display = 'none';
      hint.style.opacity = '0';
    }

    this.ui.createHUD();
    this.exhibitsSource = exhibits || [];

    this.setupInputs();

    if (!skipIntro) {
      console.log("DEBUG: Showing Instructions...");
      this.ui.showInstructions(() => {
        this.startGame();
        if (!this.player.mobileControls) document.body.requestPointerLock();
      });
    } else {
      this.startGame();
      if (!this.player.mobileControls) document.body.requestPointerLock();
    }

    // Enable Mobile Combat Controls
    if (this.player && this.player.mobileControls) {
      this.player.enableMobile();
      this.player.mobileControls.enableCombatMode();
    }

    if (this.audio && this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();
    // Start Phase 0 Music Immediately!
    if (this.audio) {
      if (this.audio.setMusicPhase) this.audio.setMusicPhase(0);
      this.musicHandle = this.audio.playMusic(() => this.active && !this.isGameOver);
    }
  }

  startGame() {
    this.cleanupLevel();
    this.cleanupLevel();
    // if (this.ui) this.ui.resetHUD(); // Removed Face

    this.weapons = WEAPONS.map(w => ({
      ...w,
      ammo: w.name === 'BLASTER' ? -1 : 0
    }));
    this.currentWeaponIdx = 0;
    this.playerHealth = 100;
    this.playerArmor = 0; // Reset Armor
    this.isGameOver = false;
    this.isVictory = false;
    this.score = 0;
    this.killStats = { normal: 0, imp: 0, wraith: 0, tank: 0, berzerker: 0, scout: 0, boss: 0 }; // Track Kills
    this.wave = 1;

    this.enemiesToSpawn = 0;
    this.waveInProgress = false;

    this.arena.create(this.exhibitsSource);

    this.exhibitsSource.forEach(ex => {
      if (ex.mesh) {
        // RESET STATE
        ex.mesh.userData.health = 100;
        ex.mesh.userData.name = ex.title || "DATA NODE";
        ex.mesh.userData.isCorrupted = false;
        ex.mesh.userData.isDead = false;
        ex.mesh.userData.fireTimer = 0;
        ex.mesh.visible = true;
        ex.mesh.scale.setScalar(1.0); // Reset pulse

        // RESTORE MATERIAL
        const restoreMat = (mat) => {
          if (mat.color) mat.color.setHex(0x00ffff); // Cyan Default
          if (mat.emissive) mat.emissive.setHex(0x000000);
        };

        if (ex.mesh.material) {
          if (Array.isArray(ex.mesh.material)) ex.mesh.material.forEach(restoreMat);
          else restoreMat(ex.mesh.material);
        }
        ex.mesh.traverse(c => {
          if (c.isMesh && c.material) {
            if (Array.isArray(c.material)) c.material.forEach(restoreMat);
            else restoreMat(c.material);
          }
        });
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

      // Resume on Click
      if (!document.pointerLockElement && this.active) {
        document.body.requestPointerLock();
        return;
      }

      // Right Click (2) or Left Click (0)
      const isAlt = e.button === 2;
      this.isFiring = true;
      this.isAltFiring = isAlt; // Track which mode
      this.shoot(isAlt);
    };
    this.mouseupHandler = () => {
      this.isFiring = false;
      this.isAltFiring = false;
    };
    document.addEventListener('mousedown', this.mousedownHandler);
    document.addEventListener('mouseup', this.mouseupHandler);
    // Prevent Context Menu on Right Click
    document.addEventListener('contextmenu', e => e.preventDefault());

    this.keyParams = { handler: (e) => this.handleKeys(e) };
    window.addEventListener('keydown', this.keyParams.handler);

    this.lockParams = { handler: () => this.handlePointerLockChange() };
    document.addEventListener('pointerlockchange', this.lockParams.handler);
  }

  deactivate() {
    console.log("GoomGame: Deactivating...");
    if (!this.active) return;

    try {
      this.active = false;

      if (this.scene.fog && this.originalFogDensity !== undefined) {
        this.scene.fog.density = this.originalFogDensity;
      }

      const footer = document.querySelector('.gallery-footer');
      if (footer) footer.style.display = 'flex'; // Restore as Flex
      const dock = document.querySelector('.mobile-dock');
      if (dock) dock.style.display = 'flex'; // Restore as Flex
      const hint = document.querySelector('.interaction-hint');
      if (hint) {
        hint.style.display = 'block';
        hint.style.opacity = '1';
      }

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

      // Disable Mobile Combat Controls
      if (this.player && this.player.mobileControls) {
        this.player.mobileControls.disableCombatMode();
      }
      console.log("GoomGame: Deactivation Complete");

      // DISPATCH EXIT EVENT
      // This tells the parent app (CrystalViewer) to restore its UI
      window.dispatchEvent(new CustomEvent('goom-exit'));

    } catch (err) {
      console.error("GoomGame: Deactivation ERROR:", err);
      // Force cleanup state even if error
      this.active = false;
      if (this.ui) this.ui.removeHUD();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  cleanupLevel() {
    if (this.weaponMesh) { this.camera.remove(this.weaponMesh); this.weaponMesh = null; }

    // Clear Intervals
    if (this.spawnInterval) clearInterval(this.spawnInterval);
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();

    // Clear Enemies
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];

    // Clear Boss & its Effects
    if (this.boss) {
      // Force remove all boss effects if any exist
      if (this.boss.effects) this.boss.effects.forEach(e => this.scene.remove(e.mesh));
      this.scene.remove(this.boss.mesh);
      this.boss = null;
    }

    this.projectiles.clear();

    // Clear Systems (Particles, Pickups)
    if (this.systems) {
      this.systems.clear();
      // Ensure particles array is actually empty
      this.systems.particles.forEach(p => { if (p.mesh) this.scene.remove(p.mesh); });
      this.systems.particles = [];
      this.systems.pickups.forEach(p => { if (p.mesh) this.scene.remove(p.mesh); });
      this.systems.pickups = [];
    }
  }

  update(delta) {
    if (!this.active) return;

    // PAUSE LOGIC: If no pointer lock and not game over, we are paused.
    // Skip all game logic updates.
    const isMobile = window.innerWidth <= 900;

    // DEBUG PAUSE STATE
    if (!isMobile && !document.pointerLockElement && !this.isGameOver && !this.isVictory) {
      return;
    }

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
    this.ui.updateStamina();
    this.ui.updateRadar(); // NEW: Real-time Radar Update

    if (this.audio && this.audio.updateListener) this.audio.updateListener(this.camera); // Audio Spatialization
    this.projectiles.update(delta);
    this.updateEnemies(delta);
    this.updateBoss(delta);
    this.updateCrystals(delta); // NEW:    // BOSS
    if (this.boss) {
      if (!this.boss.active) {
        // Check if we just killed it (logic handled in boss.update returning 'dead')
      } else {
        const res = this.boss.update(delta, this.camera.position);
        if (this.ui.updateBossHealth) this.ui.updateBossHealth(this.boss.life, this.boss.maxLife);

        if (res === 'damage_player_boss') {
          this.takePlayerDamage(25 * delta); // Contact damage
        } else if (res === 'dead') {
          // VICTORY!
          this.boss = null;
          this.isVictory = true;
          this.killStats["THE AI BUBBLE"] = 1;
          // Stop Music using the handle
          if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();

          // Play Epic Victory Song
          if (this.audio && this.audio.playVictorySong) this.audio.playVictorySong();
          else this.audio.playSound(300, 'square', 1.0, 1.0);

          // Delay UI for 2.0s to let the explosion finish and sink in (User Request: earlier)
          setTimeout(() => {
            this.ui.triggerWin(this.score, () => this.resetGame(), this.killStats);
          }, 2000);
        }
      }
    }

    this.projectiles.update(delta);


    // Mobile Combat Integration
    if (this.player && this.player.mobileControls) {
      if (this.player.mobileControls.getFire()) {
        this.shoot(false);
      }
      if (this.player.mobileControls.getAltFire()) { // NEW
        this.shoot(true);
      }
      if (this.player.mobileControls.getSwap()) {
        // Cycle Weapon
        this.currentWeaponIdx = (this.currentWeaponIdx + 1) % this.weapons.length;
        this.updateWeaponVisuals();
        this.ui.updateHUD();
      }
    }

    this.systems.updateParticles(delta);
    this.systems.updatePickups(delta, this.camera.position, (type) => this.onPickup(type));
    this.updateWeaponRecoil(delta);
  }

  onPickup(type) {
    // DISTINCT SOUNDS
    if (type === 'health') {
      this.playerHealth = Math.min(100, this.playerHealth + 50);
      this.audio.playSound(500, 'sine', 0.5, 0.3); // High Pitch Stim
      this.audio.playSound(600, 'sine', 0.5, 0.4);
    } else if (type === 'armor') {
      this.playerArmor = Math.min(200, this.playerArmor + 50); // Cap at 200
      this.audio.playSound(100, 'square', 1.0, 0.1); // CRACK / THUD
      this.audio.playSound(150, 'sawtooth', 0.8, 0.2);
    } else {
      const ammoMap = { 'ammo_shotgun': ['SHOTGUN', 8], 'ammo_launcher': ['LAUNCHER', 4], 'ammo_plasma': ['PLASMA', 40], 'ammo_bfg': ['BIG FREAKING GEMINI', 1] };
      if (ammoMap[type]) {
        const [name, amount] = ammoMap[type];
        const w = this.weapons.find(x => x.name === name);
        if (w) w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
        this.audio.playSound(800, 'triangle', 0.3, 0.1); // Click/Load
        this.audio.playSound(200, 'noise', 0.2, 0.1);    // Mechanical Clic
      }
    }
    this.ui.updateHUD();
  }

  startWave() {
    if (this.spawnInterval) clearInterval(this.spawnInterval);

    if (this.wave === 5) { this.startBossWave(); return; }
    if (this.wave > 5) { this.triggerWin(); return; }

    this.waveInProgress = true;

    // Randomized Scaling
    // Randomized Scaling (Rebalanced)
    // Less "grind", more "action"
    const baseCount = 12 + (this.wave * 6);
    const variance = Math.floor(Math.random() * 4) - 2; // +/- 2 enemies
    this.enemiesToSpawn = Math.max(10, baseCount + variance);

    const baseRate = Math.max(100, 1500 - (this.wave * 200)); // Faster start (1.3s -> 0.5s)
    const rateVariance = (Math.random() - 0.5) * 200; // Tighter variance
    const spawnRate = Math.max(100, baseRate + rateVariance);

    this.ui.showWaveTitle(`WAVE ${this.wave}`);
    if (this.audio.setMusicPhase) this.audio.setMusicPhase(this.wave);

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
    if (this.audio.setMusicPhase) this.audio.setMusicPhase(5);
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, 5, -150)); // Spawn much further away

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

  spawnEnemy(overrideType = null, overridePos = null) {
    if (!this.active) return;
    const validTargets = this.ui.crystals.filter(c => c.mesh && c.mesh.visible && c.mesh.userData.health > 0 && !c.mesh.userData.isCorrupted).map(c => c.mesh);

    let spawnPoint = overridePos ? overridePos.clone() : this.arena.getRandomSpawnPoint();

    if (!overridePos) {
      // VISIBLE SPAWNS LOGIC (Only if random spawn)
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0; forward.normalize();

      for (let i = 0; i < 10; i++) {
        const potential = this.arena.getRandomSpawnPoint();
        const toPotential = new THREE.Vector3().subVectors(potential, this.camera.position);
        const dist = toPotential.length();
        toPotential.y = 0; toPotential.normalize();

        const dot = forward.dot(toPotential);
        if (dist > 20 && dist < 55 && dot > 0.3) {
          spawnPoint = potential;
          break;
        }
      }
    }

    let target = this.camera;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const role = Math.random() < 0.8 ? 'destroyer' : 'hunter';

    if (validTargets.length > 0) {
      if (role === 'destroyer') target = pick(validTargets);
      else target = pick(validTargets); // Both go to crystals mostly?
    }

    let type = overrideType || 'normal';
    if (!overrideType) {
      const r = Math.random();
      // Wave Logic (Balances: Slightly Harder Early Game)
      if (this.wave === 1) {
        if (r < 0.30) type = 'imp'; // Increased from 0.20
        else if (r < 0.40) type = 'scout'; // Increased from 0.25 (Added Scouts)
      }
      else if (this.wave === 2) {
        if (r < 0.25) type = 'imp';
        else if (r < 0.45) type = 'scout'; // More Scouts
        else if (r < 0.60) type = 'wraith'; // Earlier Wraiths (15%)
        else if (r < 0.70) type = 'tank'; // Earlier Tanks (10%)
      }
      else if (this.wave === 3) {
        if (r < 0.20) type = 'imp';
        else if (r < 0.35) type = 'scout';
        else if (r < 0.55) type = 'wraith';
        else if (r < 0.75) type = 'tank'; // More Tanks
        else if (r < 0.85) type = 'berzerker'; // Earlier Berzerkers
      }
      else { // Wave 4 & 5 (Chaos)
        if (r < 0.15) type = 'imp';
        else if (r < 0.30) type = 'scout';
        else if (r < 0.45) type = 'wraith';
        else if (r < 0.70) type = 'tank';
        else if (r < 0.90) type = 'berzerker';
      }
    }

    const onFindTarget = (pos) => this.findNearestCrystal(pos);
    const enemy = new GlitchEnemy(this.scene, spawnPoint, target, type, role, (pos, dir, enemyType) => {
      this.projectiles.fireEnemyProjectile(pos, dir, enemyType);
    }, onFindTarget, this.wave);

    // SPAWN EFFECT
    if (this.systems) this.systems.createTeleportEffect(spawnPoint); // Cyan Teleport Beam
    if (this.audio && this.audio.play3DSound) {
      // High pitch "Teleport" chime
      this.audio.play3DSound(spawnPoint, 1500, 'sine', 1.5, 1.0);
    }

    this.enemies.push(enemy);
    this.enemiesToSpawn--;
  }

  updateEnemies(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // SAFETY CHECK: Prevent crash if properties missing
      if (!e || !e.mesh) {
        this.enemies.splice(i, 1);
        continue;
      }

      const result = e.update(delta, this.camera);

      // Kamikaze / Suicide Logic
      if (result === 'kamikaze') {
        e.takeDamage(999); // Die instantly
        if (e.mesh) this.systems.createExplosion(e.mesh.position, 0xff0000, true);
        this.takePlayerDamage(20); // 20 DMG
        this.ui.flashDamage();
        // Push Player
        const pushDir = this.camera.position.clone().sub(e.mesh.position).normalize();
        if (this.playerVelocity) {
          this.playerVelocity.add(pushDir.multiplyScalar(30.0));
        } else if (this.player && this.player.velocity) {
          this.player.velocity.add(pushDir.multiplyScalar(30.0));
        }

      } else if (result === 'melee_hit') {
        // Melee Hit (Non-Suicidal)
        // Only hit every 1.0s or so? We need a cooldown on the ENEMY side really, 
        // but for now let's just push player and deal damage if cooldown ready
        if (e.retaliationTimer <= 0) { // Reuse retal timer or add melee timer?
          e.retaliationTimer = 1.0; // Cooldown
          this.takePlayerDamage(15);
          this.ui.flashDamage();
          this.audio.playSound(100, 'sawtooth', 0.5, 0.1);
          // Push Player Away HARD
          const pushDir = this.camera.position.clone().sub(e.mesh.position).normalize();

          if (this.playerVelocity) {
            this.playerVelocity.add(pushDir.multiplyScalar(40.0));
          } else if (this.player && this.player.velocity) {
            this.player.velocity.add(pushDir.multiplyScalar(40.0));
          }
        }
      } else if (result === 'damage_player') { // Fallback for old return
        e.takeDamage(999);
        this.takePlayerDamage(10);
      } else if (result === 'damage_crystal' || result === 'explode') {
        const target = e.target;
        if (target && target.userData.health !== undefined) {
          if (target.userData.isCorrupted) {
            // Do nothing
          } else {
            let dmg = e.damage * delta * 3.0;
            if (result === 'explode') {
              dmg = 100; // MASSIVE DAMAGE
              e.takeDamage(999); // Suicide
              this.systems.createExplosion(e.mesh.position, 0xff0000, true, 10.0); // Big Boom
            }

            target.userData.health -= dmg;
            if (!this.lastAlertTime || (this.audio.audioCtx && this.audio.audioCtx.currentTime - this.lastAlertTime > 4.0)) {
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
              this.corruptCrystal(target);
            }
          }
        }
        if (Math.random() < 0.05) {
          this.systems.createExplosion(e.mesh.position, 0x00ffff, false);
        }
      }

      if (!e.active) {
        if (e.life <= 0) {
          this.systems.spawnDrop(e.mesh.position, this.wave);
          if (this.killStats && this.killStats[e.type] !== undefined) this.killStats[e.type]++;
          else if (this.killStats) this.killStats.normal++; // Fallback
        }
        this.enemies.splice(i, 1);
      }
    }
  }

  // NEW: Corrupts a crystal instead of destroying it
  corruptCrystal(crystal) {
    if (crystal.userData.isCorrupted) return; // Already corrupted

    crystal.userData.isCorrupted = true;
    crystal.userData.health = 50; // Glass Canon
    crystal.userData.maxHealth = 50;

    // Visual Transformation
    // Visual Transformation
    const setColor = (mat) => {
      if (!mat) return;
      if (mat.color) mat.color.setHex(0x330000); // Dark Red
      if (mat.emissive) {
        mat.emissive.setHex(0xff0000);
        mat.emissiveIntensity = 2.0;
      }
    };

    if (crystal.material) {
      if (Array.isArray(crystal.material)) {
        crystal.material.forEach(setColor);
      } else {
        setColor(crystal.material);
      }
    } else {
      // Traverse if it's a group
      crystal.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(setColor);
          } else {
            setColor(child.material);
          }
        }
      });
    }

    // Update UI/Label if possible (hacky access to sprite?)
    // We will rely on the "Corrupted" status being obvious visually
    const name = crystal.userData.name || "DATA NODE";
    this.ui.showWarning(`WARNING: ${name} CORRUPTED!`);
    this.audio.playSound(100, 'sawtooth', 1.0, 1.0); // Fail sound

    // Enemies ignore it now
    this.enemies.forEach(e => {
      if (e.target === crystal) {
        e.target = this.camera; // switch to player
        e.isTargetingPlayer = true;
      }
    });
  }

  destroyCrystal(crystal) {
    if (!crystal || crystal.userData.isDead) return;

    // Logic: If Corrupted, it's a kill (Good). If not Corrupted, it's a loss (Bad).
    const wasCorrupted = crystal.userData.isCorrupted;

    crystal.userData.isDead = true;
    crystal.visible = false;

    if (wasCorrupted) {
      // Good Job!
      this.ui.score += 500;
      this.ui.showWarning("CORRUPTED NODE NEUTRALIZED");
      this.audio.playSound(50, 'sawtooth', 1.0, 1.0);
    } else {
      // Bad Job!
      this.ui.score -= 1000;
      this.ui.showWarning(`HISTORY LOST: ${crystal.userData.name}`);
      this.audio.playSound(50, 'sawtooth', 3.0, 1.0); // Harsh sound
      this.audio.playSound(200, 'square', 1.5, 0.8, -1200);
    }

    this.ui.updateHUD();
    this.systems.createExplosion(crystal.position, 0xff0000, true, wasCorrupted ? 5.0 : 20.0);

    // Remove from scene only if absolutely necessary, but keeping it invisible is usually safer for references
    // if (crystal.parent) crystal.parent.remove(crystal); 
    // ^ Don't remove for now, just keep hidden/dead so findNearestCrystal skips it safely

    // Enemies ignore it now
    this.enemies.forEach(e => {
      if (e.target === crystal) {
        e.target = this.camera; // switch to player
        e.isTargetingPlayer = true;
      }
    });
  }

  updateCrystals(delta) {
    // Logic for Corrupted Crystals to attack Player
    if (!this.ui || !this.ui.crystals) return;

    this.ui.crystals.forEach(c => {
      const mesh = c.mesh;
      if (mesh && mesh.visible && mesh.userData.isCorrupted) {
        // Turret Logic
        if (!mesh.userData.fireTimer) mesh.userData.fireTimer = 0;
        mesh.userData.fireTimer += delta;

        const distSq = mesh.position.distanceToSquared(this.camera.position);
        if (distSq < 62500 && mesh.userData.fireTimer > 1.0) {
          // Fire!
          mesh.userData.fireTimer = 0;

          const worldPos = new THREE.Vector3();
          mesh.getWorldPosition(worldPos);

          const dir = new THREE.Vector3().subVectors(this.camera.position, worldPos).normalize();

          // Spawn outside the mesh (towards player)
          const spawnPos = worldPos.clone().add(new THREE.Vector3(0, 2.0, 0)).add(dir.clone().multiplyScalar(10.0));

          this.projectiles.fireEnemyProjectile(spawnPos, dir, 'corrupted', mesh);
          this.audio.playSound(300, 'sawtooth', 0.4, 0.5); // Distinct sound
        }

        // Rotate slowly & Pulsate
        mesh.rotation.y += delta;
        const pulse = 1.5 + Math.sin(performance.now() * 0.005) * 0.2; // Beeg Crystal
        mesh.scale.setScalar(pulse);

        // Glitch Particles
        if (Math.random() < 0.2) {
          const offset = new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
          this.systems.createExplosion(mesh.position.clone().add(offset), 0xff0000, false, 0.5);
        }
      }
    });
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const result = this.boss.update(delta, this.camera.position);
    if (result === 'damage_player_boss') this.takePlayerDamage(50 * delta);

    if (!this.boss.active) {
      const bossHud = document.getElementById('boss-health-container');
      if (bossHud) bossHud.remove();
      this.systems.createExplosion(this.boss.mesh.position, 0xffaa00, true, 5.0);

      // KILL ALL MINIONS
      this.enemies.forEach(e => {
        this.systems.createExplosion(e.mesh.position, 0xff0000, false, 1.0);
        this.scene.remove(e.mesh);
      });
      this.enemies = [];

      this.score += 5000;
      this.boss = null;
      if (this.audio) this.audio.playBossDeath();
      setTimeout(() => this.triggerWin(), 2000);
    }
  }

  takePlayerDamage(amount) {
    if (this.godMode || this.isVictory || this.isGameOver) return; // FIX: No damage after win

    // ARMOR LOGIC: Absorb 66% of damage
    let damageToHealth = amount;
    if (this.playerArmor > 0) {
      const absorb = amount * 0.66;
      if (this.playerArmor >= absorb) {
        this.playerArmor -= absorb;
        damageToHealth = amount - absorb;
      } else {
        damageToHealth = amount - this.playerArmor;
        this.playerArmor = 0;
      }
    }

    this.lastDamageAmount = damageToHealth; // TRACK AMOUNT FOR FACE
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

  shoot(isAlt = false) {
    if (!this.active || this.isGameOver || this.isVictory) return;

    const weapon = this.weapons[this.currentWeaponIdx];
    const time = performance.now();

    // UPDATE RELOAD UI (Blaster Only)
    if (weapon.name === 'BLASTER' && weapon.altFire) {
      const onCooldown = (time - (weapon.altFire.lastShot || 0) < weapon.altFire.cooldown);
      this.ui.updateReloadStatus(onCooldown);
    } else {
      this.ui.updateReloadStatus(false);
    }

    // ALT FIRE LOGIC
    if (isAlt) {
      if (!weapon.altFire) return; // No Alt Fire

      if (time - (weapon.altFire.lastShot || 0) < weapon.altFire.cooldown) {
        // Already handled UI above for blaster
        return;
      }

      // Cost Check
      if (weapon.name !== 'BLASTER' && weapon.ammo < weapon.altFire.cost) {
        this.ui.showWarning("NO AMMO FOR ALT FIRE!");
        this.audio.playSound(100, 'sawtooth', 0.5, 0.1);
        return;
      }

      // Fire!
      weapon.altFire.lastShot = time;
      if (weapon.name !== 'BLASTER') {
        weapon.ammo -= weapon.altFire.cost;
      }

      // Handle Types
      const alt = weapon.altFire;

      if (alt.type === 'hitscan_beam') {
        // HELIX BEAM
        this.projectiles.fireHitscan({ ...alt, name: 'BEAM' }, 0, true); // true = isHelix
        this.audio.playSound(100, 'sawtooth', 0.8, 1.5); // Deep charge sound + high pitch
        this.audio.playSound(1200, 'square', 0.5, 0.5);
      } else if (alt.type === 'projectile_slug') {
        this.projectiles.fireSlug(weapon);
        this.audio.playSound(80, 'square', 0.8, 0.5); // Deeper boom
        this.weaponRecoil = 0.5;
      } else if (alt.type === 'projectile_flak') {
        this.projectiles.fireFlak(weapon);
        this.audio.playSound(100, 'square', 0.5, 0.3); // Heavy thud
        this.weaponRecoil = 0.8;
      } else if (alt.type === 'projectile_cluster') {
        this.projectiles.fireCluster(weapon);
        // Triple WHOOSH
        this.audio.playSound(150, 'noise', 0.4, 0.2);
        setTimeout(() => this.audio.playSound(150, 'noise', 0.4, 0.2), 50);
        setTimeout(() => this.audio.playSound(150, 'noise', 0.4, 0.2), 100);
        this.weaponRecoil = 0.6;
      } else if (alt.type === 'projectile_vent') {
        this.projectiles.fireVent(weapon);
        this.audio.playSound(800, 'sawtooth', 0.5, 0.3); // High voltage zap
        this.weaponRecoil = 0.4;
      } else if (alt.type === 'bfg_singularity') {
        this.projectiles.fireSingularity(weapon);
        this.audio.playSound(40, 'sine', 2.0, 3.0); // SUPER DEEP
        this.weaponRecoil = 1.0;
      }

      this.ui.updateHUD(); // Update Ammo
      return;
    }

    // PRIMARY FIRE LOGIC
    if (time - weapon.lastShot < weapon.cooldown) return;

    if (weapon.ammo === 0) {
      if (this.audio) this.audio.playSound(200, 'sine', 0.05, 0.1);
      this.ui.showWarning("OUT OF AMMO");
      return;
    }

    weapon.lastShot = time;
    if (weapon.ammo > 0) weapon.ammo--;
    this.ui.updateHUD();

    this.weaponRecoil = 0.2;
    if (this.muzzleLight) {
      this.muzzleLight.intensity = 2.0;
      this.muzzleLight.color.setHex(weapon.color);
      setTimeout(() => this.muzzleLight.intensity = 0, 50);
    }
    // distinct primary sound
    if (weapon.name === 'BLASTER') this.audio.playSound(400, 'square', 0.1, 0.1);
    else if (this.audio && this.audio.playWeaponSound) this.audio.playWeaponSound(weapon.name);

    if (weapon.type === 'hitscan') {
      this.projectiles.fireHitscan(weapon);
    } else if (weapon.type === 'spread') {
      for (let i = 0; i < 20; i++) { // Buffed Pellet Count 8 -> 20
        this.projectiles.fireHitscan(weapon, 0.25);
      }
      this.weaponRecoil = 0.6; // Increased recoil visually to match power
    } else if (weapon.type === 'projectile' || weapon.type === 'projectile_fast') {
      this.projectiles.fireProjectile(weapon);
    } else if (weapon.type === 'bfg') {
      this.projectiles.fireBFG(weapon);
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.ui.triggerGameOver(() => this.resetGame());
    this.audio.playSound(100, 'sawtooth', 2.0, 1.0);
  }

  triggerWin() {
    this.isVictory = true;
    if (this.killStats) this.killStats.boss++; // Count the boss kill
    if (this.audio && this.audio.playVictorySong) this.audio.playVictorySong();
    this.ui.triggerWin(this.score, () => this.resetGame(), this.killStats);
  }

  resetGame() {
    if (this.musicHandle && this.musicHandle.stop) this.musicHandle.stop();
    this.cleanupLevel();
    this.startGame();
    document.body.requestPointerLock();
  }

  handleKeys(e) {
    // ALWAYS Allow Escape to unlock cursor
    if (e.code === 'Escape') {
      if (document.pointerLockElement) document.exitPointerLock();
      // If we are in victory/gameover, maybe we want to return to menu?
      if (this.isVictory || this.isGameOver) {
        // Optional: Return to main menu logic if needed
      }
      return;
    }

    if (!this.active || this.isGameOver) return;

    // Cheats
    if (e.key === '1') this.currentWeaponIdx = 0;
    if (e.key === '2') this.currentWeaponIdx = 1;
    if (e.key === '3') this.currentWeaponIdx = 2;
    if (e.key === '4') this.currentWeaponIdx = 3;
    if (e.key === '5') this.currentWeaponIdx = 4;
    this.updateWeaponVisuals();
    this.ui.updateHUD();

    // Cheat Codes
    if (e.key === 'p') {
      this.enemiesToSpawn = 0;
      this.enemies.forEach(en => en.takeDamage(9999));
    }
    if (e.key === 'l') { // Skip Level
      this.waveInProgress = false;
      this.enemiesToSpawn = 0;
      this.enemies.forEach(en => en.takeDamage(9999));
      this.boss = null; // Kill boss too
    }
    if (e.key === 'k') { // Kill Self
      this.takePlayerDamage(100);
    }
    if (e.key === 'i') { // Invincibility Toggle
      this.isGodMode = !this.isGodMode;
      this.ui.showWarning(this.isGodMode ? "GOD MODE ON" : "GOD MODE OFF");
    }
    this.handleCheatInput(e.key);
    if (e.key === 'r') this.resetGame();
    // Cycle Music Phases
    if (e.key === '+' || e.key === '=') { // + or =
      if (this.audio && this.audio.setMusicPhase) {
        let next = (this.audio.musicPhase + 1) % 6;
        this.audio.setMusicPhase(next);
        this.ui.showWarning(`MUSIC PHASE: ${next}`);
      }
    }
    if (e.key === '-' || e.key === '_') { // - or _
      if (this.audio && this.audio.setMusicPhase) {
        let prev = (this.audio.musicPhase - 1 + 6) % 6;
        this.audio.setMusicPhase(prev);
        this.ui.showWarning(`MUSIC PHASE: ${prev}`);
      }
    }
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
    // If lock is lost (user pressed Escape), show PAUSE MENU
    if (!document.pointerLockElement && this.active && !this.isGameOver && !this.isVictory) {
      if (this.audio && this.audio.audioCtx && this.audio.audioCtx.state === 'running') {
        this.audio.audioCtx.suspend();
      }

      // Show Menu
      this.ui.showPauseMenu(
        () => { // Resume
          document.body.requestPointerLock();
        },
        () => { // Exit
          this.deactivate();
        }
      );
    } else {
      // Lock acquired (Resumed)
      this.ui.hidePauseMenu();

      if (this.active && !this.isGameOver && !this.isVictory) {
        if (this.audio && this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') {
          this.audio.audioCtx.resume();
        }
      }
    }
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
    barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.085, 0, 0); // Slight separation
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.085, 0, 0); // Slight separation
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
      // Continuous fire weapons (Plasma, etc) need this loop
      // But verify cooldowns inside shoot()
      if (wName === 'PLASMA' || wName === 'BLASTER' || wName === 'BIG FREAKING GEMINI') {
        this.shoot(this.isAltFiring);
      }
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
      if (c.mesh && c.mesh.userData.health !== undefined && c.mesh.userData.health <= 0 && !c.mesh.userData.isDead && !c.mesh.userData.isCorrupted) {
        this.corruptCrystal(c.mesh);
      }
    });
  }

  findNearestCrystal(pos) {
    if (!this.ui || !this.ui.crystals) return null;
    let closest = null;
    let minDist = Infinity;
    for (const c of this.ui.crystals) {
      if (!c.mesh || !c.mesh.visible || c.mesh.userData.isDead || c.mesh.userData.isCorrupted) continue;
      const d = pos.distanceToSquared(c.mesh.position);
      if (d < minDist) {
        minDist = d;
        closest = c.mesh;
      }
    }
    return closest;
  }

}
