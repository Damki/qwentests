import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class EffectsManager {
  constructor(scene) {
    this.scene = scene
    this.particles = []
    this.flashGraphics = this.scene.add.graphics()
    this.shakeDuration = 0
    this.shakeIntensity = 0
  }
  
  createBrickBreakParticles(x, y, color, count = GameConfig.effects.particleCount.brickBreak) {
    if (!GameConfig.particlesEnabled) return
    
    for (let i = 0; i < count; i++) {
      const particle = this.createParticle(x, y, color)
      const angle = Phaser.Math.Between(0, 360)
      const speed = Phaser.Math.Between(50, 200)
      
      particle.setVelocity(
        Math.cos(Phaser.Math.DegToRad(angle)) * speed,
        Math.sin(Phaser.Math.DegToRad(angle)) * speed
      )
      
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        duration: Phaser.Math.Between(400, 800),
        onComplete: () => particle.destroy()
      })
    }
  }
  
  createPaddleHitParticles(x, y, count = GameConfig.effects.particleCount.paddleHit) {
    if (!GameConfig.particlesEnabled) return
    
    const color = GameConfig.colors.paddle
    for (let i = 0; i < count; i++) {
      const particle = this.createParticle(x, y, color)
      const angle = Phaser.Math.Between(180, 360) // Downward direction
      const speed = Phaser.Math.Between(30, 100)
      
      particle.setVelocity(
        Math.cos(Phaser.Math.DegToRad(angle)) * speed,
        Math.sin(Phaser.Math.DegToRad(angle)) * speed
      )
      
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        duration: Phaser.Math.Between(300, 500),
        onComplete: () => particle.destroy()
      })
    }
  }
  
  createExplosion(x, y, color, count = 25) {
    if (!GameConfig.particlesEnabled) return
    
    for (let i = 0; i < count; i++) {
      const particle = this.createParticle(x, y, color)
      const angle = Phaser.Math.Between(0, 360)
      const speed = Phaser.Math.Between(80, 250)
      
      particle.setVelocity(
        Math.cos(Phaser.Math.DegToRad(angle)) * speed,
        Math.sin(Phaser.Math.DegToRad(angle)) * speed
      )
      
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(500, 1000),
        onComplete: () => particle.destroy()
      })
    }
  }
  
  createPowerupCollectEffect(x, y, color) {
    if (!GameConfig.particlesEnabled) return
    
    for (let i = 0; i < GameConfig.effects.particleCount.powerup; i++) {
      const particle = this.createParticle(x, y, color)
      const angle = Phaser.Math.Between(0, 360)
      const speed = Phaser.Math.Between(100, 300)
      
      particle.setVelocity(
        Math.cos(Phaser.Math.DegToRad(angle)) * speed,
        Math.sin(Phaser.Math.DegToRad(angle)) * speed
      )
      
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        onComplete: () => particle.destroy()
      })
    }
  }
  
  createParticle(x, y, color) {
    const size = Phaser.Math.Between(3, 8)
    const graphics = this.scene.add.graphics()
    
    graphics.fillStyle(color, 1)
    graphics.fillRect(0, 0, size, size)
    
    const particle = this.scene.add.sprite(x, y)
    particle.setSize(size, size)
    
    // Use a simple texture
    const texture = this.scene.make.graphics().fillStyle(color, 1).fillRect(0, 0, size, size).generateTexture('particle_temp', size, size)
    particle.setTexture(texture)
    particle.setAlpha(1)
    particle.setDepth(100)
    
    return particle
  }
  
  screenShake(intensity = GameConfig.effects.screenShake.intensity, duration = GameConfig.effects.screenShake.duration) {
    if (!GameConfig.shadersEnabled) return
    
    this.shakeDuration = duration
    this.shakeIntensity = intensity
  }
  
  flashScreen(color = 0xffffff, alpha = 0.3, duration = GameConfig.effects.flashDuration) {
    if (!GameConfig.shadersEnabled) return
    
    this.flashGraphics.clear()
    this.flashGraphics.fillStyle(color, alpha)
    this.flashGraphics.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height)
    this.flashGraphics.setDepth(1000)
    
    this.scene.tweens.add({
      targets: this.flashGraphics,
      alpha: 0,
      duration: duration,
      onComplete: () => {
        this.flashGraphics.clear()
      }
    })
  }
  
  update() {
    // Screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= 16
      
      const shakeX = Phaser.Math.Between(-this.shakeIntensity, this.shakeIntensity)
      const shakeY = Phaser.Math.Between(-this.shakeIntensity, this.shakeIntensity)
      
      this.scene.cameras.main.scrollX = shakeX
      this.scene.cameras.main.scrollY = shakeY
      
      if (this.shakeDuration <= 0) {
        this.scene.cameras.main.scrollX = 0
        this.scene.cameras.main.scrollY = 0
      }
    }
  }
  
  clear() {
    this.flashGraphics.clear()
    this.scene.cameras.main.scrollX = 0
    this.scene.cameras.main.scrollY = 0
    this.shakeDuration = 0
  }
  
  destroy() {
    this.flashGraphics.destroy()
  }
}

export default EffectsManager
