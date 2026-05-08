import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class Paddle extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'paddle')
    
    this.baseWidth = GameConfig.paddle.baseWidth
    this.currentWidth = this.baseWidth
    this.height = GameConfig.paddle.height
    this.speed = GameConfig.paddle.speed
    this.isGiant = false
    this.hasShield = false
    this.hasLaser = false
    
    this.setup()
  }
  
  setup() {
    // Create paddle texture dynamically
    this.createTexture()
    
    this.scene.add.existing(this)
    this.scene.physics.add.existing(this)
    
    this.setImmovable(true)
    this.setCollideWorldBounds(true)
    this.body.allowGravity = false
    this.setDragX(1000)
    
    // Input handling
    this.cursors = this.scene.input.keyboard.createCursorKeys()
    this.keys = this.scene.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D
    })
    
    // Mouse/touch control
    this.scene.input.on('pointermove', (pointer) => {
      if (this.scene.isActive && this.enabled) {
        this.targetX = pointer.x
      }
    })
    
    this.scene.input.on('pointerdown', (pointer) => {
      if (this.scene.isActive && this.enabled) {
        this.targetX = pointer.x
      }
    })
    
    this.enabled = true
    this.targetX = this.x
  }
  
  createTexture() {
    const graphics = this.scene.make.graphics()
    
    // Glow effect
    graphics.fillStyle(GameConfig.colors.paddle, 0.3)
    graphics.fillRoundedRect(-5, -5, this.baseWidth + 10, this.height + 10, 8)
    
    // Main paddle body
    graphics.fillStyle(GameConfig.colors.paddle, 1)
    graphics.fillRoundedRect(0, 0, this.baseWidth, this.height, 6)
    
    // Highlight
    graphics.fillStyle(0xffffff, 0.6)
    graphics.fillRect(5, 2, this.baseWidth - 10, 4)
    
    // Generate texture
    graphics.generateTexture('paddle', this.baseWidth, this.height)
    graphics.destroy()
  }
  
  enableGiant() {
    if (!this.isGiant) {
      this.isGiant = true
      this.currentWidth = GameConfig.paddle.giantWidth
      
      // Recreate texture with new size
      this.createGiantTexture()
      
      this.setTexture('paddle_giant')
      this.refreshBody()
    }
  }
  
  disableGiant() {
    if (this.isGiant) {
      this.isGiant = false
      this.currentWidth = this.baseWidth
      
      this.setTexture('paddle')
      this.refreshBody()
    }
  }
  
  createGiantTexture() {
    const graphics = this.scene.make.graphics()
    
    graphics.fillStyle(GameConfig.colors.paddle, 0.3)
    graphics.fillRoundedRect(-5, -5, this.currentWidth + 10, this.height + 10, 8)
    
    graphics.fillStyle(GameConfig.colors.paddle, 1)
    graphics.fillRoundedRect(0, 0, this.currentWidth, this.height, 6)
    
    graphics.fillStyle(0xffffff, 0.6)
    graphics.fillRect(5, 2, this.currentWidth - 10, 4)
    
    graphics.generateTexture('paddle_giant', this.currentWidth, this.height)
    graphics.destroy()
  }
  
  enableShield() {
    if (!this.hasShield) {
      this.hasShield = true
      this.createShieldTexture()
    }
  }
  
  disableShield() {
    this.hasShield = false
    if (this.isGiant) {
      this.setTexture('paddle_giant')
    } else {
      this.setTexture('paddle')
    }
  }
  
  createShieldTexture() {
    const baseTexture = this.isGiant ? 'paddle_giant' : 'paddle'
    const width = this.isGiant ? this.currentWidth : this.baseWidth
    
    const graphics = this.scene.make.graphics()
    
    // Shield glow
    graphics.lineStyle(3, GameConfig.colors.powerupShield, 0.8)
    graphics.strokeRoundedRect(-4, -4, width + 8, this.height + 8, 10)
    
    // Base paddle
    graphics.fillStyle(GameConfig.colors.paddle, 1)
    graphics.fillRoundedRect(0, 0, width, this.height, 6)
    
    graphics.generateTexture(`paddle_shield_${this.isGiant ? 'giant' : 'normal'}`, width, this.height)
    this.setTexture(`paddle_shield_${this.isGiant ? 'giant' : 'normal'}`)
    graphics.destroy()
  }
  
  enableLaser() {
    this.hasLaser = true
  }
  
  disableLaser() {
    this.hasLaser = false
  }
  
  refreshBody() {
    this.scene.physics.world.updateBody(this)
  }
  
  update() {
    if (!this.enabled) return
    
    // Keyboard input
    let moveSpeed = 0
    if (this.cursors.left.isDown || this.keys.left.isDown || this.keys.a.isDown) {
      moveSpeed = -this.speed
    } else if (this.cursors.right.isDown || this.keys.right.isDown || this.keys.d.isDown) {
      moveSpeed = this.speed
    }
    
    // Mouse/touch takes priority
    if (this.targetX !== undefined) {
      const dx = this.targetX - this.x
      if (Math.abs(dx) > 5) {
        this.setVelocityX(dx * 10)
      } else {
        this.setVelocityX(0)
      }
    } else if (moveSpeed !== 0) {
      this.setVelocityX(moveSpeed)
    }
    
    // Clamp to world bounds
    this.x = Phaser.Math.Clamp(this.x, this.currentWidth / 2, this.scene.scale.width - this.currentWidth / 2)
  }
  
  reset() {
    this.disableGiant()
    this.disableShield()
    this.disableLaser()
    this.x = this.scene.scale.width / 2
    this.y = this.scene.scale.height - 50
    this.enabled = true
    this.targetX = this.x
  }
}

export default Paddle
