import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useGameStore = create(
  persist(
    (set, get) => ({
      // Game State
      currentState: 'menu', // menu, playing, paused, gameover, victory, help, settings
      currentLevel: 1,
      score: 0,
      highScore: 0,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      
      // Settings
      settings: {
        musicVolume: 0.7,
        sfxVolume: 0.8,
        fullscreen: false,
        difficulty: 'normal', // easy, normal, hard
        paddleSensitivity: 1.0,
        particlesEnabled: true,
        shadersEnabled: true,
      },
      
      // Powerups active
      activePowerups: [],
      
      // Actions
      setState: (state) => set({ currentState: state }),
      
      setLevel: (level) => set({ currentLevel: level }),
      
      addScore: (points) => {
        const state = get()
        const comboMultiplier = 1 + (state.combo * 0.1)
        const totalPoints = Math.floor(points * state.multiplier * comboMultiplier)
        
        set({ 
          score: state.score + totalPoints,
          combo: state.combo + 1,
          maxCombo: Math.max(state.maxCombo, state.combo + 1)
        })
      },
      
      resetCombo: () => set({ combo: 0 }),
      
      loseLife: () => {
        const state = get()
        const newLives = state.lives - 1
        
        if (newLives <= 0) {
          set({ 
            lives: 0, 
            currentState: 'gameover',
            highScore: Math.max(state.highScore, state.score)
          })
        } else {
          set({ lives: newLives, combo: 0 })
        }
      },
      
      setLives: (lives) => set({ lives }),
      
      setMultiplier: (multiplier) => set({ multiplier }),
      
      addPowerup: (powerup) => {
        const state = get()
        if (!state.activePowerups.includes(powerup)) {
          set({ activePowerups: [...state.activePowerups, powerup] })
        }
      },
      
      removePowerup: (powerup) => {
        const state = get()
        set({ 
          activePowerups: state.activePowerups.filter(p => p !== powerup) 
        })
      },
      
      clearPowerups: () => set({ activePowerups: [] }),
      
      updateSettings: (newSettings) => {
        const state = get()
        set({ 
          settings: { ...state.settings, ...newSettings } 
        })
      },
      
      resetGame: () => {
        set({
          currentLevel: 1,
          score: 0,
          lives: 3,
          combo: 0,
          multiplier: 1,
          activePowerups: [],
          currentState: 'menu'
        })
      },
      
      startGame: () => {
        set({
          score: 0,
          lives: 3,
          combo: 0,
          multiplier: 1,
          activePowerups: [],
          currentLevel: 1,
          currentState: 'playing'
        })
      },
      
      nextLevel: () => {
        const state = get()
        set({ 
          currentLevel: state.currentLevel + 1,
          combo: 0,
          multiplier: 1,
          activePowerups: []
        })
      }
    }),
    {
      name: 'arkanoid-storage',
      partialize: (state) => ({ 
        highScore: state.highScore,
        settings: state.settings 
      })
    }
  )
)
