import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
  }

  build() {
    // Grid
    const gridHelper = new THREE.GridHelper(200, 100, 0x00f3ff, 0x003344);
    gridHelper.position.y = -10;
    this.scene.add(gridHelper);

    // Lights
    const ambient = new THREE.AmbientLight(0x404040);
    this.scene.add(ambient);
    this.lights.push(ambient);

    const light1 = new THREE.PointLight(0x00f3ff, 2, 100);
    light1.position.set(0, 20, 0);
    this.scene.add(light1);
    this.lights.push(light1);

    const light2 = new THREE.PointLight(0xff0055, 1, 100);
    light2.position.set(40, -10, 40);
    this.scene.add(light2);
    this.lights.push(light2);
  }
}
