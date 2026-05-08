export const levels = [
  {
    id: 1,
    name: "Neon Dawn",
    difficulty: "easy",
    layout: [
      ".......................",
      ".......................",
      "......NNNNNNNNN........",
      "......NNRRRRRRRNN......",
      "......NNRBBBBBRNN......",
      "......NNRRRRRRRNN......",
      "......NNNNNNNNN........",
      "......................."
    ],
    // N = Normal, R = Resistant, B = Bonus, E = Explosive, I = Indestructible, G = Regenerative
    brickTypes: {
      'N': { type: 'normal', health: 1, color: 0xff00ff, score: 10 },
      'R': { type: 'resistant', health: 3, color: 0xbd00ff, score: 30 },
      'B': { type: 'bonus', health: 1, color: 0xffff00, score: 50, powerupChance: 0.5 },
      'E': { type: 'explosive', health: 1, color: 0xff4444, score: 20 },
      'I': { type: 'indestructible', health: -1, color: 0x666666, score: 0 },
      'G': { type: 'regenerative', health: 2, color: 0x00ff00, score: 25, regenRate: 5000 }
    }
  },
  {
    id: 2,
    name: "Cyber Pulse",
    difficulty: "normal",
    layout: [
      ".......................",
      ".....EEEEEEE.........",
      "....ENNNNNNNE........",
      "....ERNNNNNNRNE......",
      "....ERRRRRRRRNE......",
      "....ENRRRRRRRNE......",
      "....ENNNNNNNNE.......",
      ".....EEEEEEE........."
    ],
    brickTypes: {
      'N': { type: 'normal', health: 1, color: 0xff00ff, score: 10 },
      'R': { type: 'resistant', health: 3, color: 0xbd00ff, score: 30 },
      'E': { type: 'explosive', health: 1, color: 0xff4444, score: 20 },
      'B': { type: 'bonus', health: 1, color: 0xffff00, score: 50, powerupChance: 0.5 }
    }
  },
  {
    id: 3,
    name: "Void Walker",
    difficulty: "hard",
    layout: [
      ".......................",
      "...III.III.III.III...",
      "...NGRNGRNGRNGRNGR...",
      "...GRNGRNGRNGRNGRN...",
      "...RNGRNGRNGRNGRNG...",
      "...NGRNGRNGRNGRNGR...",
      "...III.III.III.III...",
      "......................."
    ],
    brickTypes: {
      'N': { type: 'normal', health: 1, color: 0xff00ff, score: 10 },
      'R': { type: 'resistant', health: 4, color: 0xbd00ff, score: 30 },
      'G': { type: 'regenerative', health: 3, color: 0x00ff00, score: 25, regenRate: 4000 },
      'I': { type: 'indestructible', health: -1, color: 0x666666, score: 0 },
      'B': { type: 'bonus', health: 1, color: 0xffff00, score: 50, powerupChance: 0.6 }
    }
  },
  {
    id: 4,
    name: "Quantum Break",
    difficulty: "hard",
    layout: [
      ".......................",
      "..BBBBBBBBBBBBBBBBB..",
      ".BRRRRRRRRRRRRRRRRRB.",
      "BRRGGGGGGGGGGGGGGRRRB",
      "BRRGNNNNNNNNNNNNNGRRB",
      "BRRGGGGGGGGGGGGGGRRRB",
      ".BRRRRRRRRRRRRRRRRRB.",
      "..BBBBBBBBBBBBBBBBB.."
    ],
    brickTypes: {
      'N': { type: 'normal', health: 1, color: 0xff00ff, score: 10 },
      'R': { type: 'resistant', health: 5, color: 0xbd00ff, score: 30 },
      'G': { type: 'regenerative', health: 3, color: 0x00ff00, score: 25, regenRate: 3000 },
      'B': { type: 'bonus', health: 1, color: 0xffff00, score: 50, powerupChance: 0.7 },
      'E': { type: 'explosive', health: 1, color: 0xff4444, score: 20 }
    }
  },
  {
    id: 5,
    name: "Neon Apocalypse",
    difficulty: "expert",
    layout: [
      ".......................",
      ".EEEEEEEEEEEEEEEEEEE.",
      "ERRRRRRRRRRRRRRRRRRRE",
      "ERIIIIRIIIIRIIIIRERRE",
      "ERIGRIGRIGRIGRIGRIERE",
      "ERIIIIRIIIIRIIIIRERRE",
      "ERRRRRRRRRRRRRRRRRRRE",
      ".EEEEEEEEEEEEEEEEEEE."
    ],
    brickTypes: {
      'N': { type: 'normal', health: 1, color: 0xff00ff, score: 10 },
      'R': { type: 'resistant', health: 5, color: 0xbd00ff, score: 30 },
      'G': { type: 'regenerative', health: 4, color: 0x00ff00, score: 25, regenRate: 2500 },
      'I': { type: 'indestructible', health: -1, color: 0x666666, score: 0 },
      'E': { type: 'explosive', health: 1, color: 0xff4444, score: 20 },
      'B': { type: 'bonus', health: 1, color: 0xffff00, score: 50, powerupChance: 0.8 }
    }
  }
]

export default levels
