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

        // Secret Platform (DOOM MODE TRIGGER)
        // Moved to 35 (Further Right)
        const secretGeo = new THREE.PlaneGeometry(5, 5);
        const secretMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 2.0,
            roughness: 0.2
        });
        const secretPlatform = new THREE.Mesh(secretGeo, secretMat);
        secretPlatform.rotation.x = -Math.PI / 2;
        secretPlatform.position.set(35, 0.2, 10);
        secretPlatform.name = 'SECRET_DOOM_PLATFORM';
        this.scene.add(secretPlatform);

        // Rotating Doom Icon (High-Res Voxel Question Mark)
        const qGroup = new THREE.Group();
        qGroup.position.set(35, 3, 10);

        const qMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xff0055,
            emissiveIntensity: 3.0,
            roughness: 0.2
        });

        // Voxel Construction (Grid 10x14)
        const voxSize = 0.25; // Smaller voxels
        const voxGeo = new THREE.BoxGeometry(voxSize, voxSize, voxSize);

        // Classic Question Mark Shape (1 = pixel)
        // 0 1 2 3 4 5 6
        // . X X X X .
        // X X . . X X
        // X X . . X X
        // . . . X X .
        // . . X X . .
        // . . X X . .
        // . . . . . .
        // . . X X . .

        const voxelGrid = [
            "  XXXX  ",
            " XX  XX ",
            " XX  XX ",
            "    XX  ",
            "   XX   ",
            "   XX   ",
            "        ",
            "   XX   "
        ];

        // Reverse rows so index 0 is at bottom? No, iterate top down.
        // Let's center it.
        const width = 8;
        const height = 8;

        voxelGrid.forEach((row, yIndex) => {
            // yIndex 0 is top. In 3D Y is up. So we map yIndex to (height - yIndex)
            const y = (height - yIndex) * voxSize;
            for (let xIndex = 0; xIndex < row.length; xIndex++) {
                if (row[xIndex] === 'X') {
                    const v = new THREE.Mesh(voxGeo, qMat);
                    // Center X: (xIndex - width/2)
                    const x = (xIndex - width / 2) * voxSize;
                    v.position.set(x, y - (height / 2 * voxSize), 0); // Center Y too
                    qGroup.add(v);
                }
            }
        });

        // Explicit update method for rotation to ensure smooth frame pacing
        this.update = (delta) => {
            qGroup.rotation.y += 2.0 * delta; // 2.0 radians per second approx
        };

        qGroup.scale.set(2, 2, 2); // Make it BIGGER
        this.secretIcon = qGroup; // Expose for logic
        this.scene.add(qGroup);

        // Secret Light
        const secretLight = new THREE.PointLight(0xff0000, 2.0, 20);
        secretLight.position.set(35, 5, 10);
        this.scene.add(secretLight);

        // Fog (Reduced density to prevent color fading)
        this.scene.fog = new THREE.FogExp2(0x000000, 0.002);

        // Ambient (Darker to increase contrast of glowing points)
        const ambient = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambient);
    }
}
