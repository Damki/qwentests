import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'
import { Paddle } from '../entities/Paddle'
import { Ball } from '../entities/Ball'
import { Brick } from '../entities/Brick'
import { PowerUp } from '../entities/PowerUp'
import { BallManager } from '../managers/BallManager'
import { PowerUpManager } from '../managers/PowerUpManager'
import { EffectsManager } from '../managers/EffectsManager'
import { SoundManager } from '../managers/SoundManager'
import levels from '../levels/levels'
import { useGameStore } from '../../../stores/gameStore'

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' })
    
    this.currentLevelIndex = 0
    this.balls = null
    this.bricks = null
    this.powerups = null
    this.paddle = null
    this.mainBall = null
    
    this.ballManager = null
    this.powerupManager = null
    this.effectsManager = null
    this.soundManager = null
    
    this.scoreText = null
    this.livesText = null
    this.levelText = null
    this.comboText = null
    
    this.difficultyModifier = GameConfig.difficulty.normal
    this.magnetActive = false
    this.isPaused = false
  }
  
  preload() {
    // Assets are generated dynamically in this implementation
    // In production, you would load actual assets here
  }
  
  create() {
    const store = useGameStore.getState()
    this.currentLevelIndex = store.currentLevel - 1
    this.difficultyModifier = GameConfig.difficulty[store.settings.difficulty] || GameConfig.difficulty.normal
    
    // Update config based on settings
    GameConfig.particlesEnabled = store.settings.particlesEnabled
    GameConfig.shadersEnabled = store.settings.shadersEnabled
    
    // Initialize managers
    this.soundManager = new SoundManager(this)
    this.effectsManager = new EffectsManager(this)
    this.ballManager = new BallManager(this)
    this.powerupManager = new PowerUpManager(this)
    
    // Set ball manager reference for access to Ball class
    this.ballManager.get = (type) => {
      if (type === 'Ball') return Ball
      return null
    }
    
    // Create groups
    this.balls = this.ballManager
    this.bricks = this.physics.add.group()
    this.powerups = this.powerupManager
    
    // Create paddle
    this.paddle = new Paddle(this, this.scale.width / 2, this.scale.height - 50)
    
    // Create initial ball
    this.mainBall = this.ballManager.createBall(this.paddle.x, this.paddle.y - 20)
    this.balls.add(this.mainBall)
    
    // Load level
    this.loadLevel(this.currentLevelIndex)
    
    // Setup collisions
    this.setupCollisions()
    
    // Create UI
    this.createUI()
    
    // Input handlers
    this.setupInput()
    
    // Background
    this.createBackground()
    
    // Play music
    this.soundManager.playMusic()
  }
  
  createBackground() {
    const graphics = this.add.graphics()
    
    // Dark gradient background
    const gradient = graphics.generateTexture('bgGradient', this.scale.width, this.scale.height)
    const bgSprite = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bgGradient')
    bgSprite.setDepth(-10)
    
    // Grid lines for retro effect
    graphics.lineStyle(1, 0x00f3ff, 0.1)
    
    const gridSize = 40
    for (let x = 0; x < this.scale.width; x += gridSize) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, this.scale.height)
    }
    
    for (let y = 0; y < this.scale.height; y += gridSize) {
      graphics.moveTo(0, y)
      graphics.lineTo(this.scale.width, y)
    }
    
    graphics.strokePath()
  }
  
  loadLevel(levelIndex) {
    const level = levels[levelIndex]
    if (!level) {
      this.victory()
      return
    }
    
    // Clear existing bricks
    this.bricks.clear(true, true)
    
    const brickConfig = level.brickTypes
    const layout = level.layout
    const brickWidth = GameConfig.brick.width
    const brickHeight = GameConfig.brick.height
    const gap = GameConfig.brick.gap
    const offsetX = GameConfig.brick.offsetX
    const offsetY = GameConfig.brick.offsetY
    
    // Calculate starting position to center the level
    const maxCols = Math.max(...layout.map(row => row.length))
    const totalWidth = maxCols * (brickWidth + gap) - gap
    const startX = (this.scale.width - totalWidth) / 2 + brickWidth / 2
    
    layout.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const brickType = row[colIndex]
        
        if (brickType !== '.' && brickConfig[brickType]) {
          const x = startX + colIndex * (brickWidth + gap)
          const y = offsetY + rowIndex * (brickHeight + gap)
          
          const config = brickConfig[brickType]
          const brick = new Brick(this, x, y, config)
          this.bricks.add(brick)
        }
      }
    })
    
    // Update level text
    if (this.levelText) {
      this.levelText.setText(`LEVEL ${level.id}`)
    }
  }
  
  setupCollisions() {
    // Ball vs Paddle
    this.physics.add.collider(this.balls, this.paddle, this.handleBallPaddleCollision, null, this)
    
    // Ball vs Bricks
    this.physics.add.overlap(this.balls, this.bricks, this.handleBallBrickCollision, null, this)
    
    // Powerup vs Paddle
    this.physics.add.overlap(this.powerups, this.paddle, this.handlePowerupCollection, null, this)
    
    // Ball vs World bounds
    this.balls.children.iterate(ball => {
      if (ball) {
        ball.setCollideWorldBounds(true)
        ball.body.onWorldBounds = true
      }
    })
    
    // Handle ball falling out of world
    this.physics.world.on('worldbounds', (body) => {
      const ball = body.gameObject
      if (ball && ball instanceof Ball) {
        this.handleBallLost(ball)
      }
    })
  }
  
  handleBallPaddleCollision(ball, paddle) {
    if (!ball.active || !paddle.active) return
    
    this.soundManager.playSFX('paddleHit')
    this.effectsManager.createPaddleHitParticles(ball.x, ball.y + ball.radius)
    
    // Calculate bounce angle based on where ball hits paddle
    const hitPoint = ball.x - paddle.x
    const normalizedHit = hitPoint / (paddle.currentWidth / 2)
    
    // Clamp the angle
    const minAngle = GameConfig.physics.minBounceAngle
    const maxAngle = GameConfig.physics.maxBounceAngle
    const bounceAngle = normalizedHit * maxAngle
    
    // Calculate new velocity
    const speed = ball.currentSpeed
    const newVelocityX = Math.sin(bounceAngle) * speed
    const newVelocityY = -Math.cos(bounceAngle) * speed
    
    ball.setVelocity(newVelocityX, newVelocityY)
    
    // Accelerate ball slightly
    ball.accelerate()
    
    // Reset combo on paddle hit
    useGameStore.getState().resetCombo()
  }
  
  handleBallBrickCollision(ball, brick) {
    if (!ball.active || !brick.active) return
    
    // Fireball destroys bricks without bouncing
    if (ball.isFireball) {
      brick.hit(1)
      this.soundManager.playSFX('brickBreak')
      return
    }
    
    // Determine collision side
    const ballRect = ball.getBounds()
    const brickRect = brick.getBounds()
    
    const overlapLeft = ballRect.right - brickRect.left
    const overlapRight = brickRect.right - ballRect.left
    const overlapTop = ballRect.bottom - brickRect.top
    const overlapBottom = brickRect.bottom - ballRect.top
    
    const minOverlapX = Math.min(overlapLeft, overlapRight)
    const minOverlapY = Math.min(overlapTop, overlapBottom)
    
    // Bounce off appropriate side
    if (minOverlapX < minOverlapY) {
      ball.setVelocityX(-ball.body.velocity.x)
    } else {
      ball.setVelocityY(-ball.body.velocity.y)
    }
    
    // Hit the brick
    const destroyed = brick.hit(1)
    
    if (destroyed) {
      this.soundManager.playSFX('brickBreak')
      this.effectsManager.screenShake()
      
      // Add score
      useGameStore.getState().addScore(brick.score)
      
      // Check for combo
      const store = useGameStore.getState()
      if (store.combo >= 10) {
        this.soundManager.playSFX('combo')
      }
    } else {
      this.soundManager.playSFX('brickHit')
    }
    
    // Check level complete
    this.checkLevelComplete()
  }
  
  handlePowerupCollection(powerup, paddle) {
    if (!powerup.active || !paddle.active) return
    powerup.collect(paddle)
  }
  
  handleBallLost(ball) {
    if (!ball.active) return
    
    ball.destroy()
    this.soundManager.playSFX('lifeLost')
    
    // Check if all balls lost
    const activeBalls = this.ballManager.getActiveBalls()
    
    if (activeBalls.length === 0) {
      useGameStore.getState().loseLife()
      
      const store = useGameStore.getState()
      
      if (store.lives <= 0) {
        this.gameOver()
      } else {
        // Reset ball on paddle
        this.time.delayedCall(1000, () => {
          if (this.paddle.active) {
            this.mainBall = this.ballManager.resetAll(this.paddle)
            this.balls.add(this.mainBall)
          }
        })
      }
    }
  }
  
  checkLevelComplete() {
    const remainingBricks = this.bricks.getChildren().filter(brick => 
      brick.active && !brick.isIndestructible
    )
    
    if (remainingBricks.length === 0) {
      this.levelComplete()
    }
  }
  
  levelComplete() {
    this.soundManager.playSFX('victory')
    useGameStore.getState().addScore(GameConfig.scoring.levelComplete)
    
    this.time.delayedCall(2000, () => {
      useGameStore.getState().nextLevel()
      
      const store = useGameStore.getState()
      if (store.currentLevel > levels.length) {
        this.victory()
      } else {
        this.currentLevelIndex = store.currentLevel - 1
        this.loadLevel(this.currentLevelIndex)
        this.mainBall = this.ballManager.resetAll(this.paddle)
        this.balls.add(this.mainBall)
      }
    })
  }
  
  gameOver() {
    this.physics.pause()
    this.soundManager.stopMusic()
    this.soundManager.playSFX('gameOver')
    
    this.time.delayedCall(2000, () => {
      this.scene.start('MenuScene')
    })
  }
  
  victory() {
    this.physics.pause()
    this.soundManager.stopMusic()
    this.soundManager.playSFX('victory')
    
    this.time.delayedCall(3000, () => {
      useGameStore.getState().resetGame()
      this.scene.start('MenuScene')
    })
  }
  
  createUI() {
    const store = useGameStore.getState()
    
    // Score
    this.scoreText = this.add.text(20, 20, `SCORE: ${store.score}`, {
      font: 'bold 24px Arial',
      color: '#00f3ff',
      stroke: '#000000',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(100)
    
    // Lives
    this.livesText = this.add.text(this.scale.width - 20, 20, `LIVES: ${store.lives}`, {
      font: 'bold 24px Arial',
      color: '#ff00ff',
      stroke: '#000000',
      strokeThickness: 4
    }).setScrollFactor(0).setOrigin(1, 0).setDepth(100)
    
    // Level
    const level = levels[this.currentLevelIndex]
    this.levelText = this.add.text(this.scale.width / 2, 20, `LEVEL ${level?.id || 1}`, {
      font: 'bold 24px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setScrollFactor(0).setOrigin(0.5, 0).setDepth(100)
    
    // Combo
    this.comboText = this.add.text(this.scale.width / 2, 60, '', {
      font: 'bold 18px Arial',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setScrollFactor(0).setOrigin(0.5, 0).setDepth(100)
    
    // Subscribe to store updates
    this.storeUnsubscribe = useGameStore.subscribe(
      (state) => ({ score: state.score, lives: state.lives, combo: state.combo }),
      ({ score, lives, combo }) => {
        this.scoreText.setText(`SCORE: ${score}`)
        this.livesText.setText(`LIVES: ${lives}`)
        
        if (combo > 1) {
          this.comboText.setText(`COMBO x${combo}!`)
          this.comboText.setAlpha(1)
          this.tweens.add({
            targets: this.comboText,
            alpha: 0,
            duration: 1000,
            delay: 500
          })
        }
      }
    )
  }
  
  setupInput() {
    // Pause on ESC
    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.isPaused) {
        this.pauseGame()
      } else {
        this.resumeGame()
      }
    })
    
    // Launch ball on space/click
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.mainBall && !this.mainBall.launched) {
        this.mainBall.launch()
        this.soundManager.playSFX('launch')
      }
    })
    
    this.input.on('pointerdown', () => {
      if (this.mainBall && !this.mainBall.launched) {
        this.mainBall.launch()
        this.soundManager.playSFX('launch')
      }
    })
  }
  
  pauseGame() {
    this.isPaused = true
    this.physics.pause()
    useGameStore.getState().setState('paused')
    
    // Show pause overlay
    const pauseText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'PAUSED', {
      font: 'bold 64px Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(200)
    
    this.pauseOverlay = pauseText
  }
  
  resumeGame() {
    this.isPaused = false
    this.physics.resume()
    useGameStore.getState().setState('playing')
    
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy()
      this.pauseOverlay = null
    }
  }
  
  update(time, delta) {
    if (this.isPaused) return
    
    // Update entities
    this.paddle.update()
    this.ballManager.update()
    this.powerupManager.update()
    this.effectsManager.update()
    
    // Magnet powerup
    if (this.magnetActive) {
      this.balls.children.iterate(ball => {
        if (ball && ball.active && ball.y < this.paddle.y - 100) {
          const dx = this.paddle.x - ball.x
          ball.setVelocityX(ball.body.velocity.x + dx * 0.01)
        }
      })
    }
    
    // Keep ball on paddle before launch
    if (this.mainBall && !this.mainBall.launched) {
      this.mainBall.setPosition(this.paddle.x, this.paddle.y - this.mainBall.radius - this.paddle.height / 2)
    }
  }
  
  shutdown() {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe()
    }
    
    this.effectsManager.destroy()
    this.soundManager.stopMusic()
  }
}

export default GameScene
