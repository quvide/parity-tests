import type { FixtureCasesDef } from "../dsl"

// A crossover, and a crossover with a sideswitch back
export default {
  cases: [
    {
      case: "plain",
      bpm: 120,
      subdivision: 8,
      pattern: `
        ...R
        ..L.
        R...   | XO
        ..L.
        ...R
      `,
    },
    {
      // JA/DS preference is around 70bpm
      case: "sideswitch",
      bpm: 150,
      subdivision: 16,
      pattern: `
        ...R
        .L..
        R...   | XO
        L...   | SS
        ..R.
      `,
    },
  ],
} satisfies FixtureCasesDef
