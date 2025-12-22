import * as THREE from 'three';

export class GlitchEnemy {
  static tempDir = new THREE.Vector3();

  constructor(scene, position, target, type = 'normal', role = 'hunter', onShoot = null, onFindTarget = null, wave = 1) {
    this.scene = scene;
    this.target = target;
    this.type = type;
    this.role = role; 
    this.isWraith = (type === 'wraith');
    this.onShoot = onShoot;
    this.onFindTarget = onFindTarget; 
    this.shootTimer = 0;
    this.retaliationTimer = 0; 
    this.active = true;
    this.wave = wave;

    // Base Stats (Refined for Incremental Scaling)
    // We start slightly easier than the previous "Hard" mode, but scale it up.
    const waveMultHP = 1.0 + ((wave - 1) * 0.15); // +15% HP per wave
    const waveMultSpd = 1.0 + ((wave - 1) * 0.05); // +5% Speed per wave

    this.life = 10 * waveMultHP;
    this.speed = 28 * waveMultSpd; 
    this.damage = 10;
    this.color = 0xff0000;
    this.scale = 8.6; 

    // Specialized Variants
    if (type === 'scout') {
      this.life = 5 * waveMultHP;
      this.speed = 45 * waveMultSpd;
      this.color = 0xffff00; 
      this.scale = 5.0; 
    } else if (type === 'tank') {
      this.speed = 8 * waveMultSpd; // Buffed to be mobile enough
      this.life = 60 * waveMultHP;
      this.damage = 30;
      this.color = 0x3366ff;
      this.scale = 11.5; 
    } else if (type === 'wraith') {
      this.speed = 12 * waveMultSpd;
      this.life = 20 * waveMultHP;
      this.damage = 15;
      this.color = 0x00ffff;
      this.scale = 7.2; 
    } else if (type === 'berzerker') {
      this.life = 8 * waveMultHP;
      this.speed = 55 * waveMultSpd;
      this.damage = 25;
      this.color = 0xff00ff; 
      this.scale = 6.5; 
    } else if (type === 'imp') {
      this.life = 10 * waveMultHP;
      this.speed = 22 * waveMultSpd;
      this.damage = 15;
      this.color = 0xff4400; 
      this.scale = 5.8; 
    }

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    this.buildVisuals();
    this.createHitbox();

    this.mesh.scale.set(this.scale, this.scale, this.scale);
    this.scene.add(this.mesh);

    this.createHealthBar();
  }

  // ... (keeping createHitbox and createHealthBar methods as is or assuming they are preserved if not in range) ...

  // To ensure the replacement works, we only replaced the Constructor block.
  // Now we need to update the Update method for Shooting Logic.
  // Wait, I can only do ONE contiguous block per replacement call for reliability if I can't see the whole thing easily.
  // I will split this into two calls: one for Constructor, one for Shooting Logic.
  // Actually, I can just match the constructor part above.
  /*
     RE-READING TOOL DEFINITION: "You can make a single call to replace_file_content".
     I will Replace the Constructor first.
  */

  createHitbox() {
    // Add an invisible sphere that acts as the primary collision target
    // This makes it MUCH easier to hit wireframe enemies
    // Hitbox (Invisible for Raycasting)
    const hitGeo = new THREE.SphereGeometry(this.scale * 0.15, 8, 8); // Scaled
    // Redundant safety: Visible False, Transparent, Opacity 0, DepthWrite False, Black Color
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      visible: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide // Ensure Raycast hits from inside (Point Blank)
    });
    this.hitbox = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.name = 'enemy_hitbox';
    this.hitbox.userData.enemy = this;
    this.mesh.add(this.hitbox);
  }

  createHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 64, 8);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    this.hpSprite = new THREE.Sprite(mat);
    this.hpSprite.scale.set(2.0, 0.25, 1);
    this.hpSprite.position.set(0, 2.0, 0);
    this.mesh.add(this.hpSprite);
    this.hpCanvas = canvas;
    this.hpCtx = ctx;
    this.hpTex = tex;
    this.maxLife = this.life;
  }

  updateHealthBar() {
    if (!this.hpCtx) return;
    const width = Math.max(0, (this.life / this.maxLife) * 64);
    this.hpCtx.clearRect(0, 0, 64, 8);
    this.hpCtx.fillStyle = '#330000';
    this.hpCtx.fillRect(0, 0, 64, 8);
    this.hpCtx.fillStyle = (this.life / this.maxLife) < 0.3 ? '#ff0000' : '#00ff00';
    this.hpCtx.fillRect(0, 0, width, 8);
    this.hpTex.needsUpdate = true;
  }

  update(delta, playerPos) {
    if (!this.active) return 'remove';
    if (this.retaliationTimer > 0) this.retaliationTimer -= delta;

    // TARGETING LOGIC
    let targetPos = null;

    // Default: Target the assigned crystal/model if it exists (removed .visible check)
    // Default: Target the assigned crystal/model if it exists and is alive
    const isTargetAlive = this.target && this.target.userData && (this.target.userData.health > 0) && !this.target.userData.isCorrupted;

    if (isTargetAlive) {
      targetPos = this.target.position;
    }

    // RETARGETING: If target dead OR if Destroyer is targeting Player (Fallback)
    // We want Destroyers to switch back to crystals ASAP if they get distracted
    if ((!isTargetAlive || (this.role === 'destroyer' && this.target === playerPos)) && this.onFindTarget) {
      const newTarget = this.onFindTarget(this.mesh.position);
      if (newTarget) {
        this.target = newTarget;
        targetPos = this.target.position;
      }
    }

    this.isTargetingPlayer = false;

    // Aggro Overrides: Hunt Player if close OR Retaliating
    if (!this.isWraith && playerPos) {
      const distSq = this.mesh.position.distanceToSquared(playerPos);
      let aggroRadiusSq = 14400; // Buffed Hunter: 120u (was 75u)

      // STRICT DESTROYER LOGIC
      if (this.role === 'destroyer') {
        // Only switch to player if REALLY close (Self defense)
        aggroRadiusSq = 100; 
      }

      if (this.type !== 'berzerker' && (distSq < aggroRadiusSq || this.retaliationTimer > 0)) {
        this.target = this.camera;
        this.isTargetingPlayer = true;
      } else if (this.role === 'destroyer' && !this.isTargetingPlayer) {
        // Keep targeting crystal
      }
    }

    // Safety: If no target (crystal dead and player far), wander or hunt player anyway
    if (!targetPos && playerPos) {
      targetPos = playerPos; // Fallback to player
      this.isTargetingPlayer = true;
    }

    if (!targetPos) return 'remove';

    // VECTOR POOLING
    GlitchEnemy.tempDir.subVectors(targetPos, this.mesh.position).normalize();
    this.mesh.position.add(GlitchEnemy.tempDir.multiplyScalar(this.speed * delta));

    // Rotate
    this.mesh.rotation.y += delta * 5;
    if (this.type === 'berzerker') {
      this.mesh.rotation.z += delta * 10;
    }

    // Safety: Ensure Hitbox never renders
    if (this.hitbox && this.hitbox.visible === true) this.hitbox.visible = false;

    // Attack Reach & Shooting
    const attackDistSq = this.mesh.position.distanceToSquared(targetPos);

    // SHOOTING LOGIC (Imp, Scout, Tank)
    if (this.type === 'imp' || this.type === 'scout' || this.type === 'tank') {
      this.shootTimer += delta;

      let fireRate = 2.0;
      let maxDist = 6400; // 80u

      if (this.type === 'scout') {
        fireRate = 0.8;
        maxDist = 8100; // 90u
      } else if (this.type === 'tank') {
        fireRate = 3.5; // Slow turn, slow fire
        maxDist = 14400; // 120u (Siege Unit)
      }

      if (attackDistSq < maxDist && attackDistSq > 100 && this.shootTimer > fireRate) {
        this.shootTimer = 0;
        if (this.onShoot) {
          // Determine direction
          const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
          this.onShoot(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), dir, this.type); // Pass type
        }
      }
    }

    // Attack Reach & Shooting
    if (attackDistSq < 100.0) { // Buffed from 16.0 for Large Models
      if (this.type === 'berzerker') {
        // Kamikaze ONLY on Player, otherwise normal attack on Crystal
        return this.isTargetingPlayer ? 'explode' : 'damage_crystal';
      }
      return this.isTargetingPlayer ? 'damage_player' : 'damage_crystal';
    }
    return 'move';
  }

  buildVisuals() {
    const type = this.type;
    const mat = new THREE.MeshBasicMaterial({ color: this.color, wireframe: true, transparent: type === 'wraith', opacity: 0.6 });

    // Common Parts
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    if (type === 'tank') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 1.2), mat);
      this.mesh.add(body);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.5, 8), mat);
      head.position.y = 1.0;
      this.mesh.add(head);
      // Arms
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), mat);
      armL.position.set(-0.8, 0.5, 0.2);
      this.mesh.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), mat);
      armR.position.set(0.8, 0.5, 0.2);
      this.mesh.add(armR);
    }
    else if (type === 'imp') {
      // Floating Spiky Ball logic
      const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), mat);
      this.mesh.add(core);
      // Hands
      const handL = new THREE.Mesh(new THREE.SphereGeometry(0.2), mat);
      handL.position.set(-0.6, -0.4, 0.3);
      this.mesh.add(handL);
      const handR = new THREE.Mesh(new THREE.SphereGeometry(0.2), mat);
      handR.position.set(0.6, -0.4, 0.3);
      this.mesh.add(handR);
      // Fire Eyes
      eyeMat.color.setHex(0xffff00);
      const le = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat);
      le.position.set(-0.2, 0.2, 0.5);
      this.mesh.add(le);
      const re = new THREE.Mesh(new THREE.SphereGeometry(0.1), eyeMat);
      re.position.set(0.2, 0.2, 0.5);
      this.mesh.add(re);
    }
    else if (type === 'scout') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 4), mat);
      body.rotation.x = Math.PI / 2;
      this.mesh.add(body);
      // Wings
      const w1 = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, -0.5), new THREE.Vector3(0, 0, -1)
      ]), new THREE.MeshBasicMaterial({ color: this.color, side: THREE.DoubleSide, wireframe: true }));
      w1.position.set(0.2, 0.2, 0);
      this.mesh.add(w1);
      const w2 = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(0, 0, -1)
      ]), new THREE.MeshBasicMaterial({ color: this.color, side: THREE.DoubleSide, wireframe: true }));
      w2.position.set(-0.2, 0.2, 0);
      this.mesh.add(w2);
    }
    else {
      // Normal / Berzerker / Wraith (Standard Humanoid-ish or Blocky)
      const headGeo = new THREE.BoxGeometry(1, 1.2, 1);
      const head = new THREE.Mesh(headGeo, mat);
      this.mesh.add(head);

      // Horns
      const hornGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
      const hornMat = new THREE.MeshBasicMaterial({ color: (type === 'berzerker' ? 0xff4400 : 0xffaa00) });

      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(-0.4, 0.8, 0);
      hornL.rotation.z = 0.3;
      this.mesh.add(hornL);

      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(0.4, 0.8, 0);
      hornR.rotation.z = -0.3;
      this.mesh.add(hornR);

      if (type === 'berzerker') {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.2, 4), new THREE.MeshBasicMaterial({ color: 0 }));
        spike.position.set(0, 0.8, 0);
        this.mesh.add(spike);
      }

      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), eyeMat);
      eyeL.position.set(-0.25, 0.1, 0.5);
      this.mesh.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), eyeMat);
      eyeR.position.set(0.25, 0.1, 0.5);
      this.mesh.add(eyeR);
    }
  }

  // Removed duplicate buildVisuals
  takeDamage(amount) {
    this.life -= amount;
    this.retaliationTimer = 4.0; // AGGRO for 4 seconds
    this.updateHealthBar();

    // Flash
    this.mesh.children.forEach(c => {
      // Fix: Exclude Hitbox and HealthBar from flashing
      if (c.name === 'enemy_hitbox' || c.isSprite) return;

      if (c.material) {
        c.material.color.setHex(0xffffff);
        setTimeout(() => {
          if (this.active && c.material) {
            if (c.geometry.type === 'BoxGeometry' && c.position.y === 0) c.material.color.setHex(this.color);
            else if (c.geometry.type === 'ConeGeometry') c.material.color.setHex(this.type === 'tank' || this.type === 'berzerker' ? 0xff4400 : 0xffaa00);
            else c.material.color.setHex(this.type === 'scout' ? 0xffffff : 0x00ff00);
          }
        }, 50);
      }
    });

    if (this.life <= 0) {
      this.active = false;
      this.scene.remove(this.mesh);
      this.mesh.children.forEach(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      return true; // Dead
    }
    return false; // Hit but alive
  }
}
