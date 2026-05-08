import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type) {
    super(scene, x, y, 'powerup')
    
    this.type = type // multiball, giantPaddle, laser, slow, fireball, shield, magnet
    this.width = GameConfig.powerups.width
    this.height = GameConfig.powerups.height
    this.fallSpeed = GameConfig.powerups.fallSpeed
    
    this.setup()
  }
  
  setup() {
    this.createTexture()
    
    this.scene.add.existing(this)
    this.scene.physics.add.existing(this)
    
    this.setVelocityY(this.fallSpeed)
    this.body.allowGravity = false
    this.setCollideWorldBounds(true)
    this.setBounce(0)
    
    // Rotate animation
    this.rotationSpeed = 0.02
  }
  
  createTexture() {
    const graphics = this.scene.make.graphics()
    const w = this.width
    const h = this.height
    const color = this.getColor()
    
    // Glow
    graphics.fillStyle(color, 0.3)
    graphics.fillRoundedRect(-2, -2, w + 4, h + 4, 8)
    
    // Background
    graphics.fillStyle(color, 1)
    graphics.fillRoundedRect(0, 0, w, h, 6)
    
    // Icon/letter
    graphics.fillStyle(0xffffff, 1)
    graphics.setFont('bold 14px Arial')
    const letter = this.getLetter()
    const textMetrics = graphics.textMetrics(letter)
    const textX = w / 2 - textMetrics.width / 2
    const textY = h / 2 + 6
    graphics.fillText(letter, textX, textY)
    
    graphics.generateTexture(`powerup_${this.type}`, w, h)
    this.setTexture(`powerup_${this.type}`)
    graphics.destroy()
  }
  
  getColor() {
    const colors = {
      multiball: GameConfig.colors.powerupMultiball,
      giantPaddle: GameConfig.colors.powerupGiantPaddle,
      laser: GameConfig.colors.powerupLaser,
      slow: GameConfig.colors.powerupSlow,
      fireball: GameConfig.colors.powerupFireball,
      shield: GameConfig.colors.powerupShield,
      magnet: GameConfig.colors.powerupMagnet
    }
    return colors[this.type] || 0xffffff
  }
  
  getLetter() {
    const letters = {
      multiball: 'M',
      giantPaddle: 'G',
      laser: 'L',
      slow: 'S',
      fireball: 'F',
      shield: 'S',
      magnet: 'A'
    }
    return letters[this.type] || '?'
  }
  
  update() {
    this.rotation += this.rotationSpeed
    
    // Check if off screen
    if (this.y > this.scene.scale.height + 50) {
      this.destroy()
    }
  }
  
  collect(paddle) {
    this.scene.soundManager.playSFX('powerup')
    this.scene.effectsManager.createPowerupCollectEffect(this.x, this.y, this.getColor())
    
    switch (this.type) {
      case 'multiball':
        this.scene.ballManager.spawnExtraBalls(paddle)
        break
        
      case 'giantPaddle':
        paddle.enableGiant()
        this.scene.time.delayedCall(GameConfig.powerups.duration.giantPaddle, () => {
          if (paddle.active) paddle.disableGiant()
        })
        break
        
      case 'laser':
        paddle.enableLaser()
        this.scene.time.delayedCall(GameConfig.powerups.duration.laser, () => {
          if (paddle.active) paddle.disableLaser()
        })
        break
        
      case 'slow':
        this.scene.balls.forEach(ball => {
          if (ball.active) ball.setSpeed(GameConfig.ball.minSpeed)
        })
        this.scene.time.delayedCall(GameConfig.powerups.duration.slow, () => {
          this.scene.balls.forEach(ball => {
            if (ball.active) ball.setSpeed(GameConfig.ball.baseSpeed)
          })
        })
        break
        
      case 'fireball':
        this.scene.balls.forEach(ball => {
          if (ball.active) ball.enableFireball()
        })
        this.scene.time.delayedCall(GameConfig.powerups.duration.fireball, () => {
          this.scene.balls.forEach(ball => {
            if (ball.active) ball.disableFireball()
          })
        })
        break
        
      case 'shield':
        paddle.enableShield()
        this.scene.time.delayedCall(GameConfig.powerups.duration.shield, () => {
          if (paddle.active) paddle.disableShield()
        })
        break
        
      case 'magnet':
        this.scene.magnetActive = true
        this.scene.time.delayedCall(GameConfig.powerups.duration.magnet, () => {
          this.scene.magnetActive = false
        })
        break
    }
    
    this.destroy()
  }
}

export default PowerUp
