import * as THREE from 'three';

export class GoomArena {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.bounds = { minX: -20, maxX: 20, minZ: -200, maxZ: 20 }; // Default Safe
    this.size = 200;
  }

  create(exhibitsSource) {
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = new THREE.Group();

    // 1. WALLS ONLY - V8 (WIDTH 150 & REAL LENGTH)
    console.log("🚀 GOOM ARENA V8: WIDTH 150 & FIXED LENGTH");

    let minX = -75, maxX = 75; // WIDTH 150 (Huge)
    let maxZ = 25;
    let minZ = -250;

    this.scene.traverse(obj => {
      if (obj.type === 'GridHelper') obj.visible = false;
    });

    if (exhibitsSource && exhibitsSource.length > 0) {
      // FIX: Use e.position.z directly (ArchiveManager format)
      const zValues = exhibitsSource.map(e => e.position ? e.position.z : (e.mesh ? e.mesh.position.z : 0));
      const furthestZ = Math.min(...zValues);

      // Extend 100 units past for safety
      if (furthestZ < minZ) minZ = furthestZ - 100;
      console.log("📏 V8 LENGTH CALC -> Furthest:", furthestZ, "-> Arena MinZ:", minZ);
    } else {
      console.warn("⚠️ No exhibits found for Arena sizing (V8), using default.");
    }

    this.bounds = { minX, maxX, minZ, maxZ };
    console.log("🏟️ ARENA BOUNDS:", this.bounds);

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
    this.mesh.add(gridGroup);

    // Add Walls (Visible semi-transparent walls)
    const wallHeight = 40; 
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
    this.mesh.add(wLeft);

    // Right Wall
    const wRight = new THREE.Mesh(new THREE.PlaneGeometry(depth, wallHeight), wallMat);
    wRight.position.set(maxX, wallHeight / 2, centerZ);
    wRight.rotation.y = Math.PI / 2;
    this.mesh.add(wRight);

    // Front Wall
    const wFront = new THREE.Mesh(new THREE.PlaneGeometry(width, wallHeight), wallMat);
    wFront.position.set(centerX, wallHeight / 2, maxZ);
    this.mesh.add(wFront);

    // Back Wall
    const wBack = new THREE.Mesh(new THREE.PlaneGeometry(width, wallHeight), wallMat);
    wBack.position.set(centerX, wallHeight / 2, minZ);
    this.mesh.add(wBack);

    this.scene.add(this.mesh);
  }

  constrainCamera(camera) {
      if (!camera) return;
      const b = this.bounds;
      const buffer = 2.0;
      if (b) {
        if (camera.position.x < b.minX + buffer) camera.position.x = b.minX + buffer;
        if (camera.position.x > b.maxX - buffer) camera.position.x = b.maxX - buffer;
        if (camera.position.z < b.minZ + buffer) camera.position.z = b.minZ + buffer;
        if (camera.position.z > b.maxZ - buffer) camera.position.z = b.maxZ - buffer;
      } else {
        // Fallback legacy
        const s = this.size - 2;
        if (camera.position.x < -s) camera.position.x = -s;
        if (camera.position.x > s) camera.position.x = s;
        if (camera.position.z < -s) camera.position.z = -s;
        if (camera.position.z > s) camera.position.z = s;
      }
      // Also keep above floor?
      if (camera.position.y < 2) camera.position.y = 2; // Floor is 0
  }

  getRandomSpawnPoint() {
      // Spawn on perimeter of arena bounds
      let b = this.bounds;
      if (!b) b = { minX: -20, maxX: 20, minZ: -200, maxZ: 20 }; // Fallback
  
      let spawnX, spawnZ;
  
      // Pick a side: 0=North, 1=South, 2=East, 3=West
      const side = Math.floor(Math.random() * 4);
      const buffer = 2; 
  
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

      return new THREE.Vector3(spawnX, 4, spawnZ);
  }

  cleanup() {
      if (this.mesh) {
          this.scene.remove(this.mesh);
          this.mesh = null;
      }
      // Restore Grid (if it was hidden)
      this.scene.traverse(obj => {
        if (obj.type === 'GridHelper') obj.visible = true;
      });
  }
}
