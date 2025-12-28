import * as THREE from 'three';

class FestiveManager {
    constructor() {
        this.activeSeason = null;
        this.overrideSeason = null; // For debugging
        this.materials = {};

        // Pre-warm date check
        this.checkSeason();
        console.log("Festive Manager Initialized. Season:", this.activeSeason);
    }

    checkSeason() {
        if (this.overrideSeason) {
            this.activeSeason = this.overrideSeason;
            return;
        }

        const now = new Date();
        const month = now.getMonth() + 1; // 1-12
        const day = now.getDate(); // 1-31

        this.activeSeason = null;

        // Winter Holidays: Dec 15 - Dec 31
        if (month === 12 && day >= 15) this.activeSeason = 'santa';

        // New Year: Dec 31 - Jan 3
        else if ((month === 12 && day >= 31) || (month === 1 && day <= 3)) this.activeSeason = 'party';

        // Halloween: Oct 20 - Nov 05
        else if ((month === 10 && day >= 20) || (month === 11 && day <= 5)) this.activeSeason = 'witch';

        // Valentine's: Feb 12 - Feb 16
        else if (month === 2 && day >= 12 && day <= 16) this.activeSeason = 'heart';

        // St. Patrick's: Mar 15 - Mar 19
        else if (month === 3 && day >= 15 && day <= 19) this.activeSeason = 'patrick';

        // Easter: Apr 10 - Apr 20 (Fixed range approximation)
        else if (month === 4 && day >= 10 && day <= 20) this.activeSeason = 'bunny';

        // April Fools: Apr 01
        else if (month === 4 && day === 1) this.activeSeason = 'propeller';

        // Summer: Jun 21 - Aug 31
        else if ((month === 6 && day >= 21) || month === 7 || month === 8) this.activeSeason = 'sunglasses';

        // Thanksgiving: Nov 20 - Nov 30
        else if (month === 11 && day >= 20 && day <= 30) this.activeSeason = 'pilgrim';
    }

    forceSeason(name) {
        this.overrideSeason = name;
        this.checkSeason();
        console.log("Festive Season Forced:", this.activeSeason);
    }

    getHat() {
        if (!this.activeSeason) return null;

        const group = new THREE.Group();
        group.userData.isHat = true;

        switch (this.activeSeason) {
            case 'santa': return this.createSantaHat();
            case 'witch': return this.createWitchHat();
            case 'party': return this.createPartyHat();
            case 'heart': return this.createHeartHalo();
            case 'patrick': return this.createTopHat(0x00ff00, true);
            case 'bunny': return this.createBunnyEars();
            case 'propeller': return this.createPropellerCap();
            case 'sunglasses': return this.createSunglasses();
            case 'pilgrim': return this.createTopHat(0x222222, true, true);
        }
        return null;
    }

    // --- HAT GENERATORS ---

    getMat(color, name) {
        const id = name || color;
        if (!this.materials[id]) {
            this.materials[id] = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.3,
                metalness: 0.1,
                emissive: color,
                emissiveIntensity: 0.6 // Self-illuminate so they pop in dark scene
            });
        }
        return this.materials[id];
    }

    createSantaHat() {
        const hat = new THREE.Group();
        // Red Cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 16), this.getMat(0xff0000, 'red'));
        cone.position.y = 0.6;
        cone.rotation.z = -0.2; // Tilt

        // White Base
        const base = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 16), this.getMat(0xffffff, 'white'));
        base.rotation.x = Math.PI / 2;

        // White Tip
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15), this.getMat(0xffffff, 'white'));
        tip.position.set(0.2, 1.15, 0); // Offset due to tilt

        hat.add(cone, base, tip);
        return hat;
    }

    createWitchHat() {
        const hat = new THREE.Group();
        const mat = this.getMat(0x111111, 'black');

        // Tall Cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 16), mat);
        cone.position.y = 0.75;
        // Brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 16), mat);

        // Purple Band
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), this.getMat(0xaa00ff, 'purple'));
        band.position.y = 0.1;

        hat.add(cone, brim, band);
        return hat;
    }

    createPartyHat() {
        const hat = new THREE.Group();
        // Cone with striped texture look (simplified as solid color standard material with high roughness)
        // Or actually let's make it Gold
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 16), this.getMat(0xffaa00, 'gold'));
        cone.position.y = 0.5;

        // Sparkles (Small spheres)
        const sparkleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        for (let i = 0; i < 8; i++) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.05), sparkleMat);
            s.position.set((Math.random() - 0.5), Math.random(), (Math.random() - 0.5));
            hat.add(s);
        }
        hat.add(cone);
        return hat;
    }

    createHeartHalo() {
        const shape = new THREE.Shape();
        const x = 0, y = 0;
        shape.moveTo(x + 0.5, y + 0.5);
        shape.bezierCurveTo(x + 0.5, y + 0.5, x + 0.4, y, x, y);
        shape.bezierCurveTo(x - 0.6, y, x - 0.6, y + 0.7, x - 0.6, y + 0.7);
        shape.bezierCurveTo(x - 0.6, y + 1.1, x - 0.3, y + 1.54, x + 0.5, y + 1.9);
        shape.bezierCurveTo(x + 1.2, y + 1.54, x + 1.6, y + 1.1, x + 1.6, y + 0.7);
        shape.bezierCurveTo(x + 1.6, y + 0.7, x + 1.6, y, x + 1.0, y);
        shape.bezierCurveTo(x + 0.7, y, x + 0.5, y + 0.5, x + 0.5, y + 0.5);

        const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.1, bevelThickness: 0.1 });
        geom.center(); // Center the heart

        const mesh = new THREE.Mesh(geom, this.getMat(0xff0055, 'hotpink'));
        mesh.scale.set(0.5, 0.5, 0.5);
        mesh.position.y = 1.0;

        // Floating animation logic will be handled by parent if possible, or just static float
        return mesh;
    }

    createTopHat(color, shamrock = false, buckle = false) {
        const hat = new THREE.Group();
        const mat = this.getMat(color);

        // Cylinder
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 16), mat);
        top.position.y = 0.5;

        // Brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16), mat);

        hat.add(top, brim);

        if (shamrock) {
            // Simple Shamrock (Three spheres)
            const sMat = this.getMat(0x00ff00, 'brightgreen');
            const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.15), sMat); s1.position.set(0.5, 0.5, 0);
            const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.15), sMat); s2.position.set(0.35, 0.65, 0);
            const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.15), sMat); s3.position.set(0.65, 0.65, 0);
            hat.add(s1, s2, s3);
        }

        if (buckle) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), this.getMat(0xffaa00, 'gold'));
            b.position.set(0.5, 0.2, 0);
            hat.add(b);
        }

        return hat;
    }

    createBunnyEars() {
        const hat = new THREE.Group();
        const mat = this.getMat(0xffffff, 'white');
        const pinkMat = this.getMat(0xffaabb, 'pink');

        const createEar = (xRot) => {
            const ear = new THREE.Group();
            const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.8, 4, 8), mat);
            outer.position.y = 0.4;
            const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), pinkMat);
            inner.position.y = 0.4;
            inner.position.z = 0.05;
            ear.add(outer, inner);
            ear.rotation.z = xRot;
            return ear;
        };

        const left = createEar(0.2);
        left.position.x = -0.3;
        const right = createEar(-0.2);
        right.position.x = 0.3;

        hat.add(left, right);
        return hat;
    }

    createPropellerCap() {
        const hat = new THREE.Group();
        // Cap
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.getMat(0x0000ff, 'blue'));

        // Propeller
        const prop = new THREE.Group();
        const bladeW = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.1), this.getMat(0xffff00, 'yellow'));
        const bladeH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.8), this.getMat(0xffff00, 'yellow'));
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2), this.getMat(0xff0000, 'red'));

        prop.add(bladeW, bladeH);
        prop.position.y = 0.6;

        // Animation hook
        prop.userData.isPropeller = true;

        hat.add(cap, pin, prop);
        return hat;
    }

    createSunglasses() {
        const glasses = new THREE.Group();
        const black = this.getMat(0x000000, 'black');

        // Eye Left
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16), black);
        l.rotation.x = Math.PI / 2;
        l.position.set(-0.35, 0, 0.5);

        // Eye Right
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16), black);
        r.rotation.x = Math.PI / 2;
        r.position.set(0.35, 0, 0.5);

        // Bridge
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), black);
        b.position.set(0, 0, 0.5);

        glasses.add(l, r, b);
        glasses.position.y = -0.2; // Lower them a bit
        return glasses;
    }
}

export const festiveManager = new FestiveManager();
