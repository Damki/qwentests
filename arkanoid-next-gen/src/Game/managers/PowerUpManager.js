import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'
import { PowerUp } from '../entities/PowerUp'

export class PowerUpManager extends Phaser.Physics.Arcade.Group {
  constructor(scene) {
    super(scene.physics.world, scene)
    
    this.scene = scene
    this.types = ['multiball', 'giantPaddle', 'laser', 'slow', 'fireball', 'shield', 'magnet']
    this.dropChance = GameConfig.powerups.dropChance * scene.difficultyModifier.powerupDropRate
  }
  
  dropPowerup(x, y) {
    if (Math.random() > this.dropChance) return
    
    // Random powerup type
    const type = Phaser.Utils.Array.GetRandom(this.types)
    
    const powerup = new PowerUp(this.scene, x, y, type)
    this.add(powerup)
  }
  
  update() {
    this.getChildren().forEach(powerup => {
      if (powerup.active && powerup.update) {
        powerup.update()
      }
    })
  }
  
  clear() {
    this.clear(true, true)
  }
}

export default PowerUpManager
