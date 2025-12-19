
export class Weapon {
    constructor(name, cooldown, damage, color, type, maxAmmo = -1) {
        this.name = name;
        this.cooldown = cooldown;
        this.damage = damage;
        this.color = color;
        this.type = type; // 'hitscan', 'projectile', 'spread', 'bfg'
        this.ammo = maxAmmo;
        this.maxAmmo = maxAmmo;
        this.lastShot = 0;
    }
}

export const WEAPONS = [
    new Weapon("BLASTER", 90, 1.8, 0x00ff00, 'hitscan', -1), // Fast Thrill: 11 shots/sec, Low Dmg
    new Weapon("SHOTGUN", 600, 2.5, 0xffaa00, 'spread', 12), // Heavy Hitter (Max ~62 dmg)
    new Weapon("LAUNCHER", 750, 40, 0xff0000, 'projectile', 4),
    // NEW WEAPONS
    new Weapon("PLASMA", 25, 6, 0x00ffff, 'projectile_fast', 100), // Fast but moderate damage
    new Weapon("BIG FREAKING GEMINI", 1250, 200, 0x00ff00, 'bfg', 5) // Screen wipe
];
