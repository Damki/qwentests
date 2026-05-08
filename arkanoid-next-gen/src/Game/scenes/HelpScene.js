import Phaser from 'phaser'
import { useGameStore } from '../../../stores/gameStore'

export class HelpScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HelpScene' })
  }
  
  create() {
    useGameStore.getState().setState('help')
    
    // Background
    this.createBackground()
    
    // Title
    this.add.text(this.scale.width / 2, 60, 'HOW TO PLAY', {
      font: 'bold 48px Arial',
      color: '#00f3ff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)
    
    // Content sections
    this.createControlsSection()
    this.createPowerupsSection()
    this.createBlocksSection()
    
    // Back button
    this.createBackButton()
    
    // Input
    this.input.keyboard.on('keydown-ESC', () => this.goBack())
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
  
  createControlsSection() {
    const leftX = this.scale.width * 0.25
    const rightX = this.scale.width * 0.75
    const y = 140
    
    const controlsText = [
      'CONTROLS:',
      '',
      '← → or A/D : Move Paddle',
      'Mouse : Move Paddle',
      'SPACE or Click : Launch Ball',
      'ESC : Pause Game'
    ]
    
    this.add.text(leftX, y, controlsText.join('\n'), {
      font: 'bold 18px Arial',
      color: '#ffffff',
      align: 'left'
    }).setOrigin(0, 0.5)
    
    const objectiveText = [
      'OBJECTIVE:',
      '',
      'Break all bricks to advance',
      'Don\'t let the ball fall!',
      'Collect powerups for bonuses',
      'Build combos for more points'
    ]
    
    this.add.text(rightX, y, objectiveText.join('\n'), {
      font: 'bold 18px Arial',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5, 0.5)
  }
  
  createPowerupsSection() {
    const y = 280
    const centerX = this.scale.width / 2
    
    this.add.text(centerX, y, 'POWERUPS:', {
      font: 'bold 24px Arial',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5)
    
    const powerupsText = [
      '',
      'M - Multiball (spawn extra balls)',
      'G - Giant Paddle (larger paddle)',
      'L - Laser (shoot bricks)',
      'S - Slow Motion (slower ball)',
      'F - Fireball (destroy on impact)',
      'S - Shield (extra protection)',
      'A - Magnet (attract balls)'
    ]
    
    this.add.text(centerX, y + 30, powerupsText.join('\n'), {
      font: '16px Arial',
      color: '#cccccc',
      align: 'center'
    }).setOrigin(0.5, 0)
  }
  
  createBlocksSection() {
    const y = 480
    const centerX = this.scale.width / 2
    
    this.add.text(centerX, y, 'BLOCK TYPES:', {
      font: 'bold 24px Arial',
      color: '#ff00ff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5)
    
    const blocksText = [
      '',
      'Pink (Normal) - 1 hit',
      'Purple (Resistant) - 3+ hits',
      'Red (Explosive) - Chain reaction',
      'Gray (Indestructible) - Unbreakable',
      'Green (Regenerative) - Repairs itself',
      'Yellow (Bonus) - High score + powerup'
    ]
    
    this.add.text(centerX, y + 30, blocksText.join('\n'), {
      font: '16px Arial',
      color: '#cccccc',
      align: 'center'
    }).setOrigin(0.5, 0)
    
    // Scoring info
    const scoreY = 600
    const scoreText = [
      'SCORING:',
      '',
      'Normal Brick: 10 pts',
      'Resistant: 30 pts',
      'Explosive: 20 pts',
      'Bonus: 50 pts',
      'Combo Bonus: +5 per combo level',
      'Level Complete: 1000 pts'
    ]
    
    this.add.text(centerX, scoreY, scoreText.join('\n'), {
      font: '16px Arial',
      color: '#00ffff',
      align: 'center'
    }).setOrigin(0.5, 0)
  }
  
  createBackButton() {
    const centerX = this.scale.width / 2
    const y = this.scale.height - 60
    
    const buttonBg = this.add.roundRect(centerX - 80, y - 20, 160, 40, 8, 0x000000, 0.5)
      .setStrokeStyle(2, 0xff00ff)
      .setInteractive({ cursor: 'pointer' })
      .on('pointerdown', () => this.goBack())
    
    this.add.text(centerX, y, 'BACK', {
      font: 'bold 20px Arial',
      color: '#ff00ff'
    }).setOrigin(0.5)
  }
  
  goBack() {
    this.scene.start('MenuScene')
  }
}

export default HelpScene
