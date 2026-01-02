
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

    new Weapon("SHOTGUN", 900, 4.0, 0xffaa00, 'spread', 12, 12.0, { // Buffed base damage 3.5 -> 4.0
        cooldown: 1200,
        damage: 100,
        cost: 2,        // Buffed Cost 3 -> 2
        type: 'projectile_flak',
        color: 0xff8800
    }),
    new Weapon("LAUNCHER", 750, 40, 0xff0000, 'projectile', 4, 15.0, {
        cooldown: 1200,
        damage: 20,     // Per mini-rocket
        cost: 2,        // Uses 2 Rockets
        type: 'projectile_cluster', // Fires 3
        color: 0xff4444
    }),
    new Weapon("PLASMA", 25, 6, 0x00ffff, 'projectile_fast', 100, 0, {
        cooldown: 500,
        damage: 6,
        cost: 10,       // Uses 10 Cells
        type: 'projectile_vent', // Fires 10 at once
        color: 0x0088ff
    }),
    new Weapon("BIG FREAKING GEMINI", 1250, 200, 0x00ff00, 'bfg', 5, 40.0, {
        cooldown: 3000,
        damage: 10,     // Tick damage (Singularity)
        cost: 2,        // Uses 2 Cells
        type: 'bfg_singularity', // Black hole effect
        color: 0xaa00aa // Purple
    })
];
