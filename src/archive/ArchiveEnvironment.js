import * as THREE from 'three';

export class ArchiveEnvironment {
    constructor(scene) {
        this.scene = scene;
    }

    build(length = 200) {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(100, length);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a0a,
            roughness: 0.1,
            metalness: 0.8
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.z = -length / 2 + 20;
        this.scene.add(floor);

        // Grid Lines
        const grid = new THREE.GridHelper(100, 20, 0x00ff88, 0x004433);
        grid.position.set(0, 0.1, -length / 2 + 20);
        grid.scale.set(1, 1, length / 100);
        this.scene.add(grid);

        // Ceiling Lights
        for (let z = 10; z > -length + 20; z -= 40) {
            const light = new THREE.PointLight(0x00ff88, 0.8, 50);
            light.position.set(0, 20, z);
            this.scene.add(light);

            // Physical strip
            const strip = new THREE.Mesh(
                new THREE.BoxGeometry(40, 0.5, 2),
                new THREE.MeshBasicMaterial({ color: 0x00ff88 })
            );
            strip.position.set(0, 25, z);
            this.scene.add(strip);
        }

        // Fog (Reduced density to prevent color fading)
        this.scene.fog = new THREE.FogExp2(0x000000, 0.002);

        // Ambient (Darker to increase contrast of glowing points)
        const ambient = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambient);
    }
}
