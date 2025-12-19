export class Weapon {
    constructor(name, cooldown, damage, color, type) {
        this.name = name;
        this.cooldown = cooldown;
        this.damage = damage;
        this.color = color;
        this.type = type; // 'hitscan', 'projectile', 'spread'
        this.lastShot = 0;
    }
}

export const WEAPONS = [
    new Weapon("BLASTER", 150, 1, 0x00ff00, 'hitscan'),
    new Weapon("SHOTGUN", 1000, 1, 0xffaa00, 'spread'), 
    new Weapon("LAUNCHER", 1500, 5, 0xff0000, 'projectile')
];
