import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class Brick extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config) {
    super(scene, x, y, 'brick')
    
    this.type = config.type || 'normal'
    this.health = config.health || 1
    this.maxHealth = this.health
    this.color = config.color || GameConfig.colors.brickNormal
    this.score = config.score || 10
    this.powerupChance = config.powerupChance || 0.15
    this.regenRate = config.regenRate || 0
    this.isIndestructible = this.type === 'indestructible'
    this.isExplosive = this.type === 'explosive'
    this.isRegenerative = this.type === 'regenerative'
    
    this.width = GameConfig.brick.width
    this.height = GameConfig.brick.height
    
    this.setup()
  }
  
  setup() {
    this.createTexture()
    
    this.scene.add.existing(this)
    this.scene.physics.add.existing(this)
    
    this.setImmovable(true)
    this.body.allowGravity = false
    this.setVisible(true)
    this.setActive(true)
    
    // Regeneration timer
    if (this.isRegenerative && this.regenRate > 0) {
      this.regenTimer = null
    }
  }
  
  createTexture() {
    const graphics = this.scene.make.graphics()
    const w = this.width
    const h = this.height
    
    // Glow effect based on health
    const glowAlpha = this.health / this.maxHealth
    graphics.fillStyle(this.color, glowAlpha * 0.3)
    graphics.fillRoundedRect(-2, -2, w + 4, h + 4, 6)
    
    // Main brick body
    graphics.fillStyle(this.color, 1)
    graphics.fillRoundedRect(0, 0, w, h, 4)
    
    // Highlight top
    graphics.fillStyle(0xffffff, 0.4)
    graphics.fillRect(2, 2, w - 4, h / 3)
    
    // Health indicator for resistant bricks
    if (this.maxHealth > 1 && !this.isIndestructible) {
      // Health bar background
      graphics.fillStyle(0x000000, 0.5)
      graphics.fillRect(4, h - 8, w - 8, 4)
      
      // Health bar fill
      const healthPercent = this.health / this.maxHealth
      graphics.fillStyle(this.getHealthColor(), 1)
      graphics.fillRect(4, h - 8, (w - 8) * healthPercent, 4)
    }
    
    // Indestructible pattern
    if (this.isIndestructible) {
      graphics.lineStyle(2, 0x888888, 0.5)
      for (let i = 0; i < w; i += 10) {
        graphics.moveTo(i, 0)
        graphics.lineTo(i + 10, h)
      }
      graphics.strokePath()
    }
    
    graphics.generateTexture(`brick_${this.type}_${this.health}`, w, h)
    this.setTexture(`brick_${this.type}_${this.health}`)
    graphics.destroy()
  }
  
  getHealthColor() {
    const ratio = this.health / this.maxHealth
    if (ratio > 0.66) return 0x00ff00
    if (ratio > 0.33) return 0xffff00
    return 0xff0000
  }
  
  hit(damage = 1) {
    if (this.isIndestructible) {
      this.scene.soundManager.playSFX('paddleHit')
      return false
    }
    
    this.health -= damage
    
    if (this.isExplosive) {
      this.explode()
      return true
    }
    
    if (this.health <= 0) {
      this.destroy()
      return true
    }
    
    // Update texture to show damage
    this.createTexture()
    
    // Start regeneration timer if regenerative
    if (this.isRegenerative && !this.regenTimer) {
      this.startRegeneration()
    }
    
    return false
  }
  
  startRegeneration() {
    if (this.regenTimer) return
    
    this.regenTimer = this.scene.time.delayedCall(this.regenRate, () => {
      if (this.active && this.health < this.maxHealth) {
        this.health++
        this.createTexture()
      }
      this.regenTimer = null
      
      if (this.health < this.maxHealth) {
        this.startRegeneration()
      }
    })
  }
  
  explode() {
    // Find and damage nearby bricks
    const explosionRadius = 100
    const bricks = this.scene.bricks.getChildren()
    
    bricks.forEach(brick => {
      const distance = Phaser.Math.Distance.Between(
        this.x, this.y,
        brick.x, brick.y
      )
      
      if (distance <= explosionRadius && brick !== this) {
        brick.hit(1)
      }
    })
    
    // Create explosion particles
    this.scene.effectsManager.createExplosion(this.x, this.y, this.color, 25)
  }
  
  destroy() {
    if (this.regenTimer) {
      this.regenTimer.remove()
      this.regenTimer = null
    }
    
    // Drop powerup chance
    if (Math.random() < this.powerupChance) {
      this.scene.powerupManager.dropPowerup(this.x, this.y)
    }
    
    this.scene.effectsManager.createBrickBreakParticles(this.x, this.y, this.color)
    this.scene.soundManager.playSFX('brickBreak')
    
    super.destroy()
  }
  
  reset(config) {
    this.type = config.type || 'normal'
    this.health = config.health || 1
    this.maxHealth = this.health
    this.color = config.color || GameConfig.colors.brickNormal
    this.score = config.score || 10
    this.powerupChance = config.powerupChance || 0.15
    this.regenRate = config.regenRate || 0
    this.isIndestructible = this.type === 'indestructible'
    this.isExplosive = this.type === 'explosive'
    this.isRegenerative = this.type === 'regenerative'
    
    if (this.regenTimer) {
      this.regenTimer.remove()
      this.regenTimer = null
    }
    
    this.createTexture()
    this.setVisible(true)
    this.setActive(true)
  }
}

export default Brick
