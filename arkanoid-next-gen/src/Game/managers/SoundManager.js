import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'

export class SoundManager {
  constructor(scene) {
    this.scene = scene
    this.musicVolume = GameConfig.audio.musicVolume
    this.sfxVolume = GameConfig.audio.sfxVolume
    this.muted = false
    
    // Sound effects cache
    this.sfxCache = {}
    
    this.init()
  }
  
  init() {
    // Create sound objects using Phaser's sound system
    // In production, you would load actual audio files
    // For now, we'll use placeholder sounds
    
    const sfxList = [
      'paddleHit',
      'brickHit', 
      'brickBreak',
      'powerup',
      'lifeLost',
      'gameOver',
      'victory',
      'uiClick',
      'uiHover',
      'launch',
      'combo'
    ]
    
    sfxList.forEach(name => {
      this.sfxCache[name] = {
        play: () => {
          if (!this.muted && this.scene.sound) {
            // Placeholder - in production would play actual sound
            // this.scene.sound.play(name)
          }
        },
        volume: this.sfxVolume
      }
    })
  }
  
  playMusic(key = 'music') {
    if (this.muted) return
    
    if (this.scene.sound) {
      // this.scene.sound.play(key, { loop: true, volume: this.musicVolume })
    }
  }
  
  stopMusic() {
    if (this.scene.sound) {
      // this.scene.sound.stopAll()
    }
  }
  
  pauseMusic() {
    if (this.scene.sound) {
      // this.scene.sound.pauseAll()
    }
  }
  
  resumeMusic() {
    if (this.scene.sound && !this.muted) {
      // this.scene.sound.resumeAll()
    }
  }
  
  playSFX(name) {
    if (this.muted) return
    
    const sfx = this.sfxCache[name]
    if (sfx) {
      sfx.play()
    }
  }
  
  setMusicVolume(volume) {
    this.musicVolume = Phaser.Math.Clamp(volume, 0, 1)
  }
  
  setSFXVolume(volume) {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1)
    Object.values(this.sfxCache).forEach(sfx => {
      sfx.volume = this.sfxVolume
    })
  }
  
  toggleMute() {
    this.muted = !this.muted
    return this.muted
  }
  
  setMute(muted) {
    this.muted = muted
  }
}

export default SoundManager
