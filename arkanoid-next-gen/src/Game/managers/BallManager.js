import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'
import { Ball } from '../entities/Ball'

export class BallManager extends Phaser.Physics.Arcade.Group {
  constructor(scene) {
    super(scene.physics.world, scene)
    this.scene = scene
  }
  
  createBall(x, y) {
    const ball = new Ball(this.scene, x, y)
    this.add(ball)
    return ball
  }
  
  spawnExtraBalls(paddle) {
    const balls = this.getActiveBalls()
    if (balls.length === 0) return
    
    // Create 2 extra balls from existing ball positions
    const originalBall = balls[0]
    
    for (let i = 0; i < 2; i++) {
      const newBall = new Ball(this.scene, paddle.x, paddle.y - 20)
      this.add(newBall)
      
      // Launch with slightly different angles
      const angle = -90 + (i === 0 ? -30 : 30)
      const speed = originalBall.currentSpeed
      
      this.scene.time.delayedCall(200 * (i + 1), () => {
        if (newBall.active) {
          newBall.setVelocity(
            Math.cos(Phaser.Math.DegToRad(angle)) * speed,
            Math.sin(Phaser.Math.DegToRad(angle)) * speed
          )
        }
      })
    }
    
    this.scene.soundManager.playSFX('powerup')
    this.scene.effectsManager.createExplosion(paddle.x, paddle.y, GameConfig.colors.powerupMultiball, 20)
  }
  
  resetAll(paddle) {
    this.clear(true, true)
    
    const mainBall = new Ball(this.scene, paddle.x, paddle.y - 20)
    this.add(mainBall)
    
    return mainBall
  }
  
  update() {
    this.getChildren().forEach(ball => {
      if (ball.active && ball.updateTrail) {
        ball.updateTrail()
      }
    })
  }
  
  getActiveBalls() {
    return this.getChildren().filter(ball => ball.active)
  }
}

export default BallManager
