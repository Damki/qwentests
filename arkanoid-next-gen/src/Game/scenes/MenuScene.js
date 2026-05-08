import Phaser from 'phaser'
import GameConfig from '../config/GameConfig'
import { useGameStore } from '../../../stores/gameStore'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' })
    
    this.menuItems = []
    this.selectedIndex = 0
    this.particles = []
    this.titleText = null
  }
  
  preload() {
    // No external assets needed - everything generated dynamically
  }
  
  create() {
    const store = useGameStore.getState()
    useGameStore.getState().setState('menu')
    
    // Create animated background
    this.createBackground()
    
    // Create title with neon effect
    this.createTitle()
    
    // Create menu buttons
    this.createMenuItems()
    
    // Create decorative particles
    this.createDecorativeParticles()
    
    // Input handlers
    this.setupInput()
    
    // Animate elements in
    this.animateEntrance()
  }
  
  createBackground() {
    // Dark gradient background
    const graphics = this.add.graphics()
    
    // Background fill
    graphics.fillStyle(0x0a0a0f, 1)
    graphics.fillRect(0, 0, this.scale.width, this.scale.height)
    
    // Grid pattern
    graphics.lineStyle(1, 0x00f3ff, 0.15)
    
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
    
    // Animated glow orbs
    for (let i = 0; i < 5; i++) {
      const orb = this.add.circle(
        Phaser.Math.Between(0, this.scale.width),
        Phaser.Math.Between(0, this.scale.height),
        Phaser.Math.Between(50, 150),
        Phaser.Utils.Array.GetRandom([0x00f3ff, 0xff00ff, 0xbd00ff]),
        0.1
      )
      orb.setDepth(-1)
      
      this.tweens.add({
        targets: orb,
        x: orb.x + Phaser.Math.Between(-200, 200),
        y: orb.y + Phaser.Math.Between(-200, 200),
        scale: orb.scale + Phaser.Math.Between(-0.3, 0.3),
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }
  }
  
  createTitle() {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height * 0.25
    
    // Main title
    this.titleText = this.add.text(centerX, centerY, 'ARKANOID', {
      font: 'bold 80px Arial',
      color: '#ffffff',
      stroke: '#00f3ff',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(10)
    
    // Subtitle
    const subtitle = this.add.text(centerX, centerY + 70, 'NEXT GEN', {
      font: 'bold 32px Arial',
      color: '#ff00ff',
      stroke: '#000000',
      strokeThickness: 4,
      letterSpacing: 8
    }).setOrigin(0.5).setDepth(10)
    
    // Neon glow animation
    this.tweens.add({
      targets: this.titleText,
      strokeColor: 0xff00ff,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    
    // Pulse animation
    this.tweens.add({
      targets: [this.titleText, subtitle],
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }
  
  createMenuItems() {
    const centerX = this.scale.width / 2
    const startY = this.scale.height * 0.55
    const spacing = 70
    
    const menuOptions = [
      { label: 'START GAME', action: () => this.startGame(), color: '#00f3ff' },
      { label: 'SETTINGS', action: () => this.openSettings(), color: '#ff00ff' },
      { label: 'HELP', action: () => this.openHelp(), color: '#00ffff' },
      { label: 'EXIT', action: () => this.exitGame(), color: '#ff4444' }
    ]
    
    menuOptions.forEach((option, index) => {
      const y = startY + index * spacing
      
      // Button background
      const buttonBg = this.add.roundRect(centerX - 150, y - 25, 300, 50, 10, 0x000000, 0.5)
        .setStrokeStyle(2, 0x00f3ff, 0.5)
        .setDepth(5)
      
      // Button text
      const buttonText = this.add.text(centerX, y, option.label, {
        font: 'bold 24px Arial',
        color: option.color
      }).setOrigin(0.5).setDepth(6)
      
      // Store reference
      const menuItem = {
        bg: buttonBg,
        text: buttonText,
        action: option.action,
        baseColor: option.color,
        y: y
      }
      
      this.menuItems.push(menuItem)
      
      // Hover animation setup
      buttonBg.setInteractive({ cursor: 'pointer' })
        .on('pointerover', () => this.onMenuItemHover(menuItem))
        .on('pointerout', () => this.onMenuItemOut(menuItem))
        .on('pointerdown', () => {
          this.onMenuItemClick(menuItem)
          menuItem.action()
        })
    })
    
    // High score display
    const highScore = store.highScore || 0
    this.add.text(centerX, startY + menuOptions.length * spacing + 40, 
      `HIGH SCORE: ${highScore}`, {
        font: 'bold 20px Arial',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(10)
  }
  
  createDecorativeParticles() {
    // Create floating particles
    for (let i = 0; i < 50; i++) {
      const size = Phaser.Math.Between(2, 5)
      const x = Phaser.Math.Between(0, this.scale.width)
      const y = Phaser.Math.Between(0, this.scale.height)
      const color = Phaser.Utils.Array.GetRandom([0x00f3ff, 0xff00ff, 0xffffff])
      
      const particle = this.add.circle(x, y, size, color, Phaser.Math.Between(0.3, 0.7))
      particle.setDepth(1)
      
      // Animate
      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(50, 150),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        repeat: -1,
        ease: 'Sine.easeOut',
        delay: Phaser.Math.Between(0, 2000)
      })
      
      this.particles.push(particle)
    }
  }
  
  setupInput() {
    // Keyboard navigation
    this.cursorKeys = this.input.keyboard.createCursorKeys()
    this.lastKeyTime = 0
    this.keyDelay = 150
    
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.menuItems[this.selectedIndex]) {
        this.menuItems[this.selectedIndex].action()
      }
    })
    
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.menuItems[this.selectedIndex]) {
        this.menuItems[this.selectedIndex].action()
      }
    })
  }
  
  update(time, delta) {
    // Keyboard navigation
    if (time > this.lastKeyTime + this.keyDelay) {
      if (this.cursorKeys.up.isDown) {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length
        this.updateMenuSelection()
        this.lastKeyTime = time
      } else if (this.cursorKeys.down.isDown) {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length
        this.updateMenuSelection()
        this.lastKeyTime = time
      }
    }
  }
  
  updateMenuSelection() {
    this.menuItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        // Selected state
        item.bg.setStrokeStyle(3, 0xffffff, 1)
        item.text.setScale(1.1)
        item.text.setColor('#ffffff')
      } else {
        // Normal state
        item.bg.setStrokeStyle(2, 0x00f3ff, 0.5)
        item.text.setScale(1)
        item.text.setColor(item.baseColor)
      }
    })
  }
  
  onMenuItemHover(item) {
    this.tweens.add({
      targets: item.bg,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 200,
      ease: 'Back.easeOut'
    })
    
    item.text.setColor('#ffffff')
  }
  
  onMenuItemOut(item) {
    this.tweens.add({
      targets: item.bg,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })
    
    item.text.setColor(item.baseColor)
  }
  
  onMenuItemClick(item) {
    this.tweens.add({
      targets: item.bg,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 100,
      yoyo: true,
      ease: 'Back.easeInOut'
    })
  }
  
  animateEntrance() {
    // Animate menu items in
    this.menuItems.forEach((item, index) => {
      item.bg.setAlpha(0)
      item.text.setAlpha(0)
      
      this.tweens.add({
        targets: [item.bg, item.text],
        alpha: 1,
        delay: index * 100,
        duration: 500,
        ease: 'Power2.out'
      })
    })
  }
  
  startGame() {
    this.scene.start('GameScene')
  }
  
  openSettings() {
    this.scene.start('SettingsScene')
  }
  
  openHelp() {
    this.scene.start('HelpScene')
  }
  
  exitGame() {
    // For web, we can't really exit, so just show a message
    const exitText = this.add.text(this.scale.width / 2, this.scale.height / 2, 
      'You can close the browser tab', {
        font: 'bold 32px Arial',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(100)
    
    this.time.delayedCall(2000, () => {
      exitText.destroy()
    })
  }
  
  shutdown() {
    // Cleanup
    this.particles.forEach(p => p.destroy())
  }
}

export default MenuScene
