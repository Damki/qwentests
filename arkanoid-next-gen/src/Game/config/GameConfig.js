export const GameConfig = {
  // Screen dimensions
  width: 1280,
  height: 720,
  
  // Colors - Neon theme
  colors: {
    background: 0x0a0a0f,
    paddle: 0x00f3ff,
    ball: 0xffffff,
    ballTrail: 0x00f3ff,
    brickNormal: 0xff00ff,
    brickResistant: 0xbd00ff,
    brickExplosive: 0xff4444,
    brickIndestructible: 0x666666,
    brickRegenerative: 0x00ff00,
    brickBonus: 0xffff00,
    powerupMultiball: 0x00ffff,
    powerupGiantPaddle: 0xff00ff,
    powerupLaser: 0xff4444,
    powerupSlow: 0x00ff00,
    powerupFireball: 0xff8800,
    powerupShield: 0x0088ff,
    powerupMagnet: 0xaa00ff
  },
  
  // Paddle settings
  paddle: {
    width: 120,
    height: 16,
    speed: 600,
    baseWidth: 120,
    giantWidth: 200,
    color: 0x00f3ff,
    glow: 20
  },
  
  // Ball settings
  ball: {
    radius: 8,
    baseSpeed: 400,
    maxSpeed: 900,
    minSpeed: 300,
    acceleration: 1.05,
    color: 0xffffff,
    trailLength: 20
  },
  
  // Brick settings
  brick: {
    width: 80,
    height: 30,
    gap: 8,
    rows: 6,
    cols: 13,
    offsetY: 80,
    offsetX: 40,
    
    // Health values
    normalHealth: 1,
    resistantHealth: 3,
    regenerativeRate: 5000 // ms to regenerate
  },
  
  // Powerup settings
  powerups: {
    width: 40,
    height: 20,
    fallSpeed: 150,
    duration: {
      multiball: 0, // instant
      giantPaddle: 10000,
      laser: 8000,
      slow: 5000,
      fireball: 10000,
      shield: 15000,
      magnet: 8000
    },
    dropChance: 0.15 // 15% chance to drop from brick
  },
  
  // Lives and scoring
  lives: {
    initial: 3,
    max: 5
  },
  
  scoring: {
    brickNormal: 10,
    brickResistant: 30,
    brickExplosive: 20,
    brickBonus: 50,
    comboBonus: 5,
    levelComplete: 1000
  },
  
  // Physics
  physics: {
    gravity: 0,
    bounceDamping: 1.0,
    minBounceAngle: 0.15,
    maxBounceAngle: 0.85,
    paddleInfluence: 0.75
  },
  
  // Difficulty modifiers
  difficulty: {
    easy: {
      ballSpeed: 0.8,
      paddleSize: 1.2,
      powerupDropRate: 1.3
    },
    normal: {
      ballSpeed: 1.0,
      paddleSize: 1.0,
      powerupDropRate: 1.0
    },
    hard: {
      ballSpeed: 1.3,
      paddleSize: 0.85,
      powerupDropRate: 0.7
    }
  },
  
  // Visual effects
  effects: {
    particleCount: {
      brickBreak: 15,
      paddleHit: 8,
      powerup: 20
    },
    screenShake: {
      intensity: 5,
      duration: 200
    },
    flashDuration: 100
  },
  
  // Audio
  audio: {
    musicVolume: 0.7,
    sfxVolume: 0.8
  }
}

export default GameConfig
