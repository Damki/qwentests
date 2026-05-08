import Phaser from 'phaser'
import { useGameStore } from '../../../stores/gameStore'

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' })
    
    this.settingsItems = []
    this.selectedIndex = 0
  }
  
  create() {
    const store = useGameStore.getState()
    useGameStore.getState().setState('settings')
    
    // Background
    this.createBackground()
    
    // Title
    this.add.text(this.scale.width / 2, 80, 'SETTINGS', {
      font: 'bold 48px Arial',
      color: '#00f3ff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)
    
    // Create settings controls
    this.createSettingsControls(store.settings)
    
    // Back button
    this.createBackButton()
    
    // Input handlers
    this.setupInput()
  }
  
  createBackground() {
    const graphics = this.add.graphics()
    
    graphics.fillStyle(0x0a0a0f, 1)
    graphics.fillRect(0, 0, this.scale.width, this.scale.height)
    
    graphics.lineStyle(1, 0x00f3ff, 0.1)
    
    const gridSize = 50
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
  
  createSettingsControls(settings) {
    const centerX = this.scale.width / 2
    const startY = 150
    const spacing = 70
    
    const settingsConfig = [
      {
        key: 'musicVolume',
        label: 'Music Volume',
        type: 'slider',
        min: 0,
        max: 100,
        value: Math.round(settings.musicVolume * 100)
      },
      {
        key: 'sfxVolume',
        label: 'SFX Volume',
        type: 'slider',
        min: 0,
        max: 100,
        value: Math.round(settings.sfxVolume * 100)
      },
      {
        key: 'difficulty',
        label: 'Difficulty',
        type: 'select',
        options: ['easy', 'normal', 'hard'],
        value: settings.difficulty
      },
      {
        key: 'particlesEnabled',
        label: 'Particles',
        type: 'toggle',
        value: settings.particlesEnabled
      },
      {
        key: 'shadersEnabled',
        label: 'Visual Effects',
        type: 'toggle',
        value: settings.shadersEnabled
      }
    ]
    
    settingsConfig.forEach((config, index) => {
      const y = startY + index * spacing
      
      // Label
      this.add.text(centerX - 200, y, config.label, {
        font: 'bold 20px Arial',
        color: '#ffffff'
      }).setOrigin(0, 0.5)
      
      let control
      
      if (config.type === 'slider') {
        control = this.createSlider(centerX + 100, y, config)
      } else if (config.type === 'select') {
        control = this.createSelect(centerX + 100, y, config)
      } else if (config.type === 'toggle') {
        control = this.createToggle(centerX + 100, y, config)
      }
      
      this.settingsItems.push({
        key: config.key,
        control: control,
        type: config.type,
        config: config
      })
    })
  }
  
  createSlider(x, y, config) {
    const width = 200
    const height = 20
    
    // Track
    const track = this.add.roundRect(x - width / 2, y - height / 2, width, height, 10, 0x333333)
      .setStrokeStyle(2, 0x00f3ff)
    
    // Handle
    const handleX = x - width / 2 + (config.value / config.max) * width
    const handle = this.add.circle(handleX, y, 12, 0x00f3ff)
    
    // Value text
    const valueText = this.add.text(x + width / 2 + 20, y, `${config.value}%`, {
      font: 'bold 18px Arial',
      color: '#ffffff'
    }).setOrigin(0, 0.5)
    
    // Make interactive
    handle.setInteractive({ draggable: true, cursor: 'pointer' })
      .on('drag', (pointer, dragX) => {
        const newX = Phaser.Math.Clamp(dragX, x - width / 2, x + width / 2)
        handle.x = newX
        
        const percent = (newX - (x - width / 2)) / width
        const value = Math.round(percent * config.max)
        valueText.setText(`${value}%`)
        
        // Update store
        const storeValue = value / 100
        if (config.key === 'musicVolume') {
          useGameStore.getState().updateSettings({ musicVolume: storeValue })
        } else if (config.key === 'sfxVolume') {
          useGameStore.getState().updateSettings({ sfxVolume: storeValue })
        }
      })
    
    return { track, handle, valueText }
  }
  
  createSelect(x, y, config) {
    const width = 150
    const height = 40
    
    // Background
    const bg = this.add.roundRect(x - width / 2, y - height / 2, width, height, 8, 0x000000, 0.5)
      .setStrokeStyle(2, 0x00f3ff)
    
    // Value text
    const valueText = this.add.text(x, y, config.value.toUpperCase(), {
      font: 'bold 18px Arial',
      color: '#ffffff'
    }).setOrigin(0.5)
    
    // Make interactive
    bg.setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => {
        const currentIndex = config.options.indexOf(config.value)
        const nextIndex = (currentIndex + 1) % config.options.length
        const newValue = config.options[nextIndex]
        
        valueText.setText(newValue.toUpperCase())
        useGameStore.getState().updateSettings({ [config.key]: newValue })
      })
    
    return { bg, valueText }
  }
  
  createToggle(x, y, config) {
    const width = 60
    const height = 30
    
    // Track
    const trackColor = config.value ? 0x00f3ff : 0x333333
    const track = this.add.roundRect(x - width / 2, y - height / 2, width, height, 15, trackColor)
    
    // Handle
    const handleX = config.value ? x + width / 2 - 15 : x - width / 2 + 15
    const handle = this.add.circle(handleX, y, 12, 0xffffff)
    
    // Make interactive
    track.setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => {
        const newValue = !config.value
        config.value = newValue
        
        // Animate
        this.tweens.add({
          targets: handle,
          x: newValue ? x + width / 2 - 15 : x - width / 2 + 15,
          duration: 200,
          ease: 'Power2.out'
        })
        
        track.setFillStyle(newValue ? 0x00f3ff : 0x333333)
        
        useGameStore.getState().updateSettings({ [config.key]: newValue })
      })
    
    return { track, handle }
  }
  
  createBackButton() {
    const centerX = this.scale.width / 2
    const y = this.scale.height - 100
    
    const buttonBg = this.add.roundRect(centerX - 100, y - 25, 200, 50, 10, 0x000000, 0.5)
      .setStrokeStyle(2, 0xff00ff)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.goBack())
    
    this.add.text(centerX, y, 'BACK', {
      font: 'bold 24px Arial',
      color: '#ff00ff'
    }).setOrigin(0.5)
  }
  
  setupInput() {
    this.input.keyboard.on('keydown-ESC', () => this.goBack())
  }
  
  goBack() {
    this.scene.start('MenuScene')
  }
}

export default SettingsScene
