import * as THREE from 'three';

export class GlitchEnemy {
  static tempDir = new THREE.Vector3();

  constructor(scene, position, target, type = 'normal', role = 'hunter', onShoot = null, onFindTarget = null) {
    this.scene = scene;
    this.target = target;
    this.type = type;
    this.role = role; // 'hunter' or 'destroyer'
    this.isWraith = (type === 'wraith');
    this.onShoot = onShoot; // Callback
    this.onFindTarget = onFindTarget; // Callback for retargeting
    this.shootTimer = 0;
    this.retaliationTimer = 0; // New: For "Only attack if attacked" logic
    this.active = true;

    // Base Stats
    this.life = 10;
    this.speed = 27; // Buffed (was 22)
    this.damage = 10;
    this.color = 0xff0000;
    this.scale = 8.6; // Buffed (was 7.2)

    // Specialized Variants
    if (type === 'scout') {
      this.life = 5;
      this.speed = 42; // Buffed (was 35)
      this.color = 0xffff00; 
      this.scale = 5.0; // Buffed (was 4.2)
    } else if (type === 'tank') {
      this.speed = 4; // Buffed (was 3)
      this.life = 60;
      this.damage = 25;
      this.color = 0x3366ff;
      this.scale = 11.5; // Buffed (was 9.6) 
    } else if (type === 'wraith') {
      this.speed = 7; // Buffed (was 5)
      this.life = 20;
      this.damage = 15;
      this.color = 0x00ffff;
      this.scale = 7.2; // Buffed (was 6.0)
    } else if (type === 'berzerker') {
      this.life = 8;
      this.speed = 50;
      this.damage = 25;
      this.color = 0xff00ff; 
      this.scale = 6.5; // Buffed (was 5.4)
    } else if (type === 'imp') {
      this.life = 10;
      this.speed = 18;
      this.damage = 15;
      this.color = 0xff4400; 
      this.scale = 5.8; // Buffed (was 4.8)
    }

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    this.buildVisuals();
    this.createHitbox();

    this.mesh.scale.set(this.scale, this.scale, this.scale);
    this.scene.add(this.mesh);

    this.createHealthBar();
  }

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
      depthWrite: false
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
    if (this.target && this.target.userData.health > 0) {
      targetPos = this.target.position;
    } else if (this.role === 'destroyer' && this.onFindTarget) {
      // Dynamic Retargeting: Current target dead? Find a new one instantly.
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
      let aggroRadiusSq = 5625; // Default Hunter: 75u

      // STRICT DESTROYER LOGIC
      if (this.role === 'destroyer') {
        // Only target player if Retaliating
        if (this.retaliationTimer > 0) {
          aggroRadiusSq = 10000; // Infinite/Large range when angry
        } else {
          aggroRadiusSq = 0; // Ignore player completely if not angry
        }
      }

      if (aggroRadiusSq > 0 && distSq < aggroRadiusSq) { 
        targetPos = playerPos;
        this.isTargetingPlayer = true;
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

    // SHOOTING LOGIC (Imp & Scout)
    if (this.type === 'imp' || this.type === 'scout') {
      this.shootTimer += delta;

      const fireRate = this.type === 'scout' ? 0.8 : 2.0; // Scout buff (0.8s)
      const maxDist = this.type === 'scout' ? 8100 : 6400; // Scouts shoot from further (90u vs 80u)

      if (attackDistSq < maxDist && attackDistSq > 100 && this.shootTimer > fireRate) {
        this.shootTimer = 0;
        if (this.onShoot) {
          // Determine direction
          const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
          this.onShoot(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), dir, this.type); // Pass type
        }
      }
    }

    if (attackDistSq < 16.0) {
      if (this.type === 'berzerker') return 'explode'; // KAMIKAZE
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
    return true; // Hit but alive
  }
}
