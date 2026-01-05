# GOOM Engine (Prismata Defense Kernel)
## Technical Reference Manual

> **Version**: 1.2
> **Codename**: "Glitch-Doom"
> **Framework**: Vanilla Three.js + Web Audio API (No External Game Engine)

---

## 1. Engine Overview
The **GOOM Engine** is a lightweight, custom-built 3D game engine designed specifically for the *Prismata* "Operation Firewall" mode. Unlike standard WebGL game development which often relies on heavy frameworks (Unity WebGL, Godot, PlayCanvas), GOOM is built from scratch on top of **Three.js** to ensure immediate load times (0 assets to download) and direct integration with the React/Redux state of the main application.

### Core Philosophy
*   **Procedural Everything**: All assets (textures, sounds, models, particles) are generated via code at runtime.
*   **Zero-Asset**: No `.mp3`, `.png`, or `.glb` files are loaded. This keeps the bundle size infinitesimal.
*   **Arcade Physics**: Custom AABB (Axis-Aligned Bounding Box) and Sphere-based collision detection for deterministic, fast gameplay.

---

## 2. Architecture
The engine uses a semi-ECS (Entity Component System) pattern but simplified for JavaScript class-based inheritance.

### Directory Structure (`src/archive/goom/`)
*   **`GoomGame.js`**: The Kernel. Handles the `requestAnimationFrame` loop, state management (Wave, Score, Game Over), and binds all subsystems.
*   **`GoomArena.js`**: Procedural Level Generator. Creates the grid, walls, and pillars using Three.js InstancedMesh for performance.
*   **`FirstPersonController.js`**: Player physics. Handles velocity, friction, jumping (gravity), and camera pitch/yaw.
*   **`GoomEnemy.js`**: AI Agents. Defines the `GlitchEnemy` class with state-machine behaviors (Chasing, Strafing, Attacking).
*   **`GoomProjectiles.js`**: The Ballistics Engine. Manages thousands of projectiles (Hitscan and Physical Objects).
*   **`GoomSystems.js`**: VFX Manager. Handles Particle Systems (Explosions, Sparks), Loot Drops, and Floating Text.
*   **`GoomAudio.js`**: The Synthesizer. A complete procedural audio engine using Web Audio API nodes.

---

## 3. Subsystems Deep Dive

### A. The Audio Synthesizer (`GoomAudio.js`)
Instead of playing pre-recorded audio files, the engine synthesizes sound in real-time using mathematical waveforms. This allows for infinite variation and zero download size.

*   **Oscillators**: Uses `Sawtooth` (aggressive, jagged sounds for shooting), `Square` (8-bit NES style), and `Sine` (pure tones for UI/Pickup) waves.
*   **Noise Generation**: Creates a white noise buffer for percussive effects (explosions, wind).
*   **Spatial Audio**: Uses `PannerNode` (HRTF) to position sounds in 3D space relative to the player's camera.
*   **Dynamic Filtering**: High-pass and Low-pass filters simulate material impacts.

### B. Enemy AI (`GoomEnemy.js`)
Enemies operate on a finite state machine:
1.  **Spawn**: Teleport in with visual effects.
2.  **Acquire Target**: Priority is usually the Player, but "Destroyer" types target Crystal Models (the objective).
3.  **Navigation**: Direct line-of-sight pathing.
4.  **Combat**:
    *   **Scouts**: Fast, low health. Attempt to flank and ram (Melee).
    *   **Tanks**: Slow, high health. Fire explosive rockets.
    *   **Imps**: Swarm tactics. Kamikaze attacks.
    *   **Boss (The AI Bubble)**: A complex multi-game-phase boss with massive health, phase transitions, and summoning abilities.

### C. Combat & Physics (`GoomProjectiles.js`)
*   **Hitscan**: Instant raycasting (e.g., Railgun/Blaster). Checked via `Raycaster` against enemy Hitbox spheres.
*   **Projectiles**: Physical objects (Rockets, Plasma). They have velocity and are updated tick-by-tick.
*   **Collision**:
    *   **Sphere-to-Sphere**: Used for projectile vs Enemy.
    *   **Sphere-to-AABB**: Used for Player vs Walls.
*   **Optimization**: Enemies use a simplified "Hitbox" sphere for collision to avoid expensive Mesh-to-Mesh precision checks.

---

## 4. Deep Dive: The Audio Graph Topology
The audio engine constructs a new node graph for every sound event, traversing from Source to Destination.

### Node Chain Example (Plasma Shot)
```mermaid
graph LR
    OSC[Oscillator(Sawtooth)] --> A[Gain(Envelope)]
    MOD[Oscillator(Sine LFO)] --> B[Gain(Modulation)]
    B --> OSC
    A --> PAN[PannerNode(HRTF)]
    PAN --> DEST[AudioDestination]
```
1.  **Source**: High-frequency Sawtooth wave (200Hz - 600Hz).
2.  **Envelope**: Exponential decay on Gain node (Attack: 0.01s, Release: 0.1s).
3.  **Spatialization**: `PannerNode` calculates the Interaural Time Difference (ITD) based on camera quaternion.

---

## 5. Wave Generation Algorithm
Difficulty is not hard-coded but derived from a curve function in `GoomGame.js`.

**Formula**:
`Enemies = Base(12) + (Wave * 5) + RandomVariance(±2)`

**Spawn Rate**:
`Rate = Max(900ms, 1500ms - (Wave * 150ms))`

This creates a linear progression of tension. However, "Director" logic intervenes:
*   **Crowd Control**: If enemies > 30, spawning pauses to prevent CPU overload and unfair swarming.
*   **Variety Injection**: Wave 3+ forces a shuffle of enemy types (introducing Tanks and Wraiths) to break the player's rhythm.

---

## 6. Weaponry & Ballistics
All weapons are procedurally defined in `GoomWeapons.js`.

*   **Blaster**: Standard hitscan pistol. Infinite ammo.
*   **Shotgun**: Raycast spread. High close-range damage.
*   **Launcher**: Physical projectile with gravity and splash damage radius.
*   **Plasma**: Rapid-fire physical projectiles. Zero gravity.
*   **BFG 9000**: Analyzing... *[REDACTED]* (Massive Area of Effect Singularity).

---

## 7. Performance Tips
To maintain 60FPS+ on mobile and low-end devices:
1.  **Instancing**: Floor tiles and wall segments use `InstancedMesh`.
2.  **Object Pooling**: Particles (Sparks, Debris) are recycled in pools rather than created/destroyed.
3.  **Low Poly**: Geometry usage is kept minimal (Primitives like Box, Cone, Cylinder).
4.  **No Textures**: All visuals use Vertex Colors or simple materials, avoiding expensive Texture lookups.

---

## 8. Debugging / Cheats
*   `~` (Tilde): Toggle Dev Console (if enabled).
*   **God Mode**: Toggled via specific key sequences (Developer Only).

---
*Maintained by the Prismata Engineering Team*
