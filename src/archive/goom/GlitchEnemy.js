import * as THREE from 'three';

export class GlitchEnemy {
    constructor(scene, position, target) {
        this.scene = scene;
        this.target = target;
        this.life = 6;
        this.speed = 12; // Slightly faster to be threatening
        this.active = true;

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);

        // Demon Head Visuals
        const headGeo = new THREE.BoxGeometry(1, 1.2, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        const head = new THREE.Mesh(headGeo, mat);
        this.mesh.add(head);

        // Horns
        const hornGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
        const hornMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

        const hornL = new THREE.Mesh(hornGeo, hornMat);
        hornL.position.set(-0.4, 0.8, 0);
        hornL.rotation.z = 0.3;
        this.mesh.add(hornL);

        const hornR = new THREE.Mesh(hornGeo, hornMat);
        hornR.position.set(0.4, 0.8, 0);
        hornR.rotation.z = -0.3;
        this.mesh.add(hornR);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.25, 0.1, 0.5);
        this.mesh.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.25, 0.1, 0.5);
        this.mesh.add(eyeR);

        this.scene.add(this.mesh);
    }

    update(delta) {
        if (!this.active || !this.target) return 'remove';

        const dist = this.mesh.position.distanceTo(this.target.position);

        // Move
        const dir = new THREE.Vector3().subVectors(this.target.position, this.mesh.position).normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));

        // Rotate
        this.mesh.rotation.x += delta * 5;
        this.mesh.rotation.y += delta * 5;

        // Attack Reach
        if (dist < 3.0) {
            return 'damage';
        }
        return 'move';
    }

    takeDamage(amount) {
        this.life -= amount;

        // Flash
        this.mesh.children.forEach(c => {
            if (c.material) {
                const old = c.material.color.getHex();
                c.material.color.setHex(0xffffff);
                setTimeout(() => {
                    if (this.active && c.material) {
                        // Reset to rough defaults
                        if (c.geometry.type === 'BoxGeometry' && c.position.y === 0) c.material.color.setHex(0xff0000);
                        else if (c.geometry.type === 'ConeGeometry') c.material.color.setHex(0xffaa00);
                        else c.material.color.setHex(0x00ff00);
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
        return false;
    }
}
