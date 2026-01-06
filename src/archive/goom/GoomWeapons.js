
export class Weapon {
    constructor(name, cooldown, damage, color, type, maxAmmo = -1, splashRadius = 0, altFire = null) {
        this.name = name;
        this.cooldown = cooldown;
        this.damage = damage;
        this.color = color;
        this.type = type; // 'hitscan', 'projectile', 'spread', 'bfg'
        this.ammo = maxAmmo;
        this.maxAmmo = maxAmmo;
        this.lastShot = 0;
        this.splashRadius = splashRadius;
        this.altFire = altFire; // { cooldown, damage, cost, type, color, lastShot }
    }
}

export const WEAPONS = [
    new Weapon("BLASTER", 80, 5.0, 0x00ff00, 'hitscan', -1, 0, {
        cooldown: 2000,
        damage: 40,     // Railgun Damage (High)
        cost: 0,        // Infinite ammo, just cooldown
        type: 'hitscan_beam',
        color: 0x00ffff // Cyan Beam
    }),

    new Weapon("SHOTGUN", 900, 4.0, 0xffaa00, 'spread', 24, 25.0, { // Max 24
        cooldown: 1200,
        damage: 150, // Buffed from 100
        cost: 2,
        type: 'projectile_flak',
        color: 0xff8800
    }),
    new Weapon("LAUNCHER", 750, 40, 0xff0000, 'projectile', 12, 15.0, { // Max 12 (3x Base)
        cooldown: 1200,
        damage: 20,
        cost: 2,
        type: 'projectile_cluster', 
        color: 0xff4444
    }),
    new Weapon("PLASMA", 25, 6, 0x00ffff, 'projectile_fast', 200, 0, { // Max 200 (Was 100)
        cooldown: 500,
        damage: 6,
        cost: 10,
        type: 'projectile_vent',
        color: 0x0088ff
    }),
    new Weapon("BIG FREAKING GEMINI", 1250, 200, 0x00ff00, 'bfg', 10, 40.0, { // Max 10 (Was 5)
        cooldown: 3000,
        damage: 50, // Buffed from 10 for stronger ticks
        cost: 2,
        type: 'bfg_singularity',
        color: 0xaa00aa
    }),
    new Weapon("DISASSEMBLER", 150, 100, 0xff00ff, 'melee', -1, 0, { // Infinite Ammo, Fast
        cooldown: 150, // Fast punches
        damage: 100, // MASSIVE DAMAGE per hit
        cost: 0,
        type: 'melee_heavy',
        color: 0xff00ff
    })
];
