import { useEffect, useRef } from 'react'
import initGame from '../Game/ArkanoidGame'

export default function GameContainer() {
  const gameRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = initGame('game-container')
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      id="game-container"
      className="w-full h-full"
    />
  )
}
