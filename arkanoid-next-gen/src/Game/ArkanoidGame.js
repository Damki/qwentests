import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'
import MenuScene from './scenes/MenuScene'
import GameScene from './scenes/GameScene'
import SettingsScene from './scenes/SettingsScene'
import HelpScene from './scenes/HelpScene'

class ArkanoidGame extends Phaser.Game {
  constructor(config) {
    super(config)
    
    // Register all scenes
    this.scene.add('MenuScene', MenuScene, true)
    this.scene.add('GameScene', GameScene)
    this.scene.add('SettingsScene', SettingsScene)
    this.scene.add('HelpScene', HelpScene)
  }
}

export function initGame(containerId = 'game-container') {
  const config = {
    type: Phaser.AUTO,
    width: GameConfig.width,
    height: GameConfig.height,
    backgroundColor: GameConfig.colors.background,
    parent: containerId,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GameConfig.width,
      height: GameConfig.height
    },
    render: {
      pixelArt: false,
      antialias: true,
      powerPreference: 'high-performance'
    },
    fps: {
      target: 60,
      forceSetTimeOut: false
    }
  }
  
  return new ArkanoidGame(config)
}

export default initGame
