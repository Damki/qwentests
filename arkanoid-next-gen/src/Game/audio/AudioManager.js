import { Howl } from 'howler'

class AudioManager {
  constructor() {
    this.music = null
    this.sfx = {}
    this.musicVolume = 0.7
    this.sfxVolume = 0.8
    this.muted = false
  }

  init() {
    // Background music - synthwave style
    this.music = new Howl({
      src: ['/audio/music.ogg'],
      loop: true,
      volume: this.musicVolume,
      html5: true
    })

    // Sound effects
    this.sfx = {
      paddleHit: new Howl({
        src: ['/audio/paddle-hit.mp3'],
        volume: this.sfxVolume
      }),
      
      brickHit: new Howl({
        src: ['/audio/brick-hit.mp3'],
        volume: this.sfxVolume
      }),
      
      brickBreak: new Howl({
        src: ['/audio/brick-break.mp3'],
        volume: this.sfxVolume
      }),
      
      powerup: new Howl({
        src: ['/audio/powerup.mp3'],
        volume: this.sfxVolume
      }),
      
      lifeLost: new Howl({
        src: ['/audio/life-lost.mp3'],
        volume: this.sfxVolume
      }),
      
      gameOver: new Howl({
        src: ['/audio/game-over.mp3'],
        volume: this.sfxVolume
      }),
      
      victory: new Howl({
        src: ['/audio/victory.mp3'],
        volume: this.sfxVolume
      }),
      
      uiClick: new Howl({
        src: ['/audio/ui-click.mp3'],
        volume: this.sfxVolume
      }),
      
      uiHover: new Howl({
        src: ['/audio/ui-hover.mp3'],
        volume: this.sfxVolume * 0.5
      }),
      
      launch: new Howl({
        src: ['/audio/launch.mp3'],
        volume: this.sfxVolume
      }),
      
      combo: new Howl({
        src: ['/audio/combo.mp3'],
        volume: this.sfxVolume
      })
    }

    return this
  }

  playMusic() {
    if (!this.muted && this.music) {
      this.music.play()
    }
    return this
  }

  stopMusic() {
    if (this.music) {
      this.music.stop()
    }
    return this
  }

  pauseMusic() {
    if (this.music) {
      this.music.pause()
    }
    return this
  }

  resumeMusic() {
    if (this.music && !this.muted) {
      this.music.play()
    }
    return this
  }

  playSFX(name) {
    if (!this.muted && this.sfx[name]) {
      this.sfx[name].play()
    }
    return this
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.music) {
      this.music.volume(this.musicVolume)
    }
    return this
  }

  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
    Object.values(this.sfx).forEach(sfx => {
      sfx.volume(this.sfxVolume)
    })
    return this
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.muted) {
      this.stopMusic()
    } else {
      this.resumeMusic()
    }
    return this.muted
  }

  dispose() {
    if (this.music) {
      this.music.unload()
    }
    Object.values(this.sfx).forEach(sfx => {
      sfx.unload()
    })
  }
}

export const audioManager = new AudioManager()
export default audioManager
