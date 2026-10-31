import type { FixtureCasesDef } from "../dsl"

// Brackets of three and four arrows: the side feet stay, U/D is ambiguous
export default {
  bpm: 150,
  subdivision: 16,
  cases: [
    {
      case: "bracket",
      pattern: `
        L...
        .R..
        L.L.   | BR
      `,
    },
    {
      case: "quad",
      pattern: `
        L...
        ...R
        LRLR   | BR JU
      `,
    },
    {
      case: "triple",
      bpm: 100,
      subdivision: 8,
      pattern: `
        L...
        ...R
        L11R   | BR JU
      `,
    },
  ],
} satisfies FixtureCasesDef
