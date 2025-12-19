
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
    new Weapon("BLASTER", 90, 15, 0x00ff00, 'hitscan', -1), // Ultra-Fast Semi-Auto (90ms)
    new Weapon("SHOTGUN", 600, 3, 0xffaa00, 'spread', 12), // Faster Pump
    new Weapon("LAUNCHER", 750, 40, 0xff0000, 'projectile', 4),
    // NEW WEAPONS
    new Weapon("PLASMA", 25, 8, 0x00ffff, 'projectile_fast', 100), // Rapid fire machine gun style, more ammo
    new Weapon("BFG 9000", 1250, 200, 0x00ff00, 'bfg', 5) // Slower but more devastating
];
