import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'ball')
    
    this.radius = GameConfig.ball.radius
    this.baseSpeed = GameConfig.ball.baseSpeed
    this.currentSpeed = this.baseSpeed
    this.maxSpeed = GameConfig.ball.maxSpeed
    this.minSpeed = GameConfig.ball.minSpeed
    this.acceleration = GameConfig.ball.acceleration
    this.isFireball = false
    this.trail = []
    this.trailLength = GameConfig.ball.trailLength
    
    this.setup()
  }
  
  setup() {
    this.createTexture()
    
    this.scene.add.existing(this)
    this.scene.physics.add.existing(this)
    
    this.setCollideWorldBounds(true)
    this.setBounce(1)
    this.body.allowGravity = false
    this.setDrag(0)
    
    // Create trail graphics
    this.trailGraphics = this.scene.add.graphics()
    
    this.launched = false
  }
  
  createTexture() {
    const graphics = this.scene.make.graphics()
    
    // Outer glow
    graphics.fillStyle(GameConfig.colors.ballTrail, 0.3)
    graphics.fillCircle(this.radius + 4, this.radius + 4, this.radius + 4)
    
    // Main ball
    graphics.fillStyle(GameConfig.colors.ball, 1)
    graphics.fillCircle(this.radius, this.radius, this.radius)
    
    // Inner highlight
    graphics.fillStyle(0xffffff, 0.8)
    graphics.fillCircle(this.radius - 2, this.radius - 2, this.radius / 3)
    
    graphics.generateTexture('ball', this.radius * 2, this.radius * 2)
    graphics.destroy()
  }
  
  createFireballTexture() {
    const graphics = this.scene.make.graphics()
    
    // Fire glow
    graphics.fillStyle(0xff8800, 0.4)
    graphics.fillCircle(this.radius + 6, this.radius + 6, this.radius + 6)
    
    graphics.fillStyle(0xff4400, 0.6)
    graphics.fillCircle(this.radius + 3, this.radius + 3, this.radius + 3)
    
    // Main ball
    graphics.fillStyle(0xffff00, 1)
    graphics.fillCircle(this.radius, this.radius, this.radius)
    
    graphics.generateTexture('ball_fire', this.radius * 2 + 4, this.radius * 2 + 4)
    graphics.destroy()
  }
  
  launch(angle = -90) {
    if (!this.launched) {
      this.launched = true
      this.scene.time.delayedCall(500, () => {
        this.setVelocityY(-this.currentSpeed)
      })
    }
  }
  
  launchFromPaddle(paddle) {
    this.setPosition(paddle.x, paddle.y - this.radius - paddle.height / 2)
    this.launched = false
    this.setVelocity(0, 0)
    this.isFireball = false
    this.setTexture('ball')
    this.currentSpeed = this.baseSpeed
  }
  
  enableFireball() {
    if (!this.isFireball) {
      this.isFireball = true
      this.createFireballTexture()
      this.setTexture('ball_fire')
    }
  }
  
  disableFireball() {
    if (this.isFireball) {
      this.isFireball = false
      this.setTexture('ball')
    }
  }
  
  accelerate() {
    const speed = Math.min(this.currentSpeed * this.acceleration, this.maxSpeed)
    this.setSpeed(speed)
    this.currentSpeed = speed
  }
  
  setSpeed(speed) {
    const velocity = this.body.velocity
    const angle = Math.atan2(velocity.y, velocity.x)
    this.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    )
    this.currentSpeed = speed
  }
  
  updateTrail() {
    if (!GameConfig.particlesEnabled) return
    
    this.trail.push({ x: this.x, y: this.y, alpha: 1 })
    
    if (this.trail.length > this.trailLength) {
      this.trail.shift()
    }
    
    // Update trail graphics
    this.trailGraphics.clear()
    
    for (let i = 0; i < this.trail.length; i++) {
      const point = this.trail[i]
      const alpha = (i / this.trail.length) * 0.5
      const size = (i / this.trail.length) * this.radius
      
      this.trailGraphics.fillStyle(GameConfig.colors.ballTrail, alpha)
      this.trailGraphics.fillCircle(point.x, point.y, size)
    }
  }
  
  clearTrail() {
    this.trail = []
    this.trailGraphics.clear()
  }
  
  reset(x, y) {
    this.launched = false
    this.clearTrail()
    this.disableFireball()
    this.currentSpeed = this.baseSpeed
    this.setPosition(x, y)
    this.setVelocity(0, 0)
  }
  
  destroy() {
    this.trailGraphics.destroy()
    super.destroy()
  }
}

export default Ball
