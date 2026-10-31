import type { FixtureCasesDef } from "../dsl"

// Sideswitch into a cross from a bracket and back
export default {
  subdivision: 16,
  cases: [
    {
      case: "plain",
      bpm: 145,
      pattern: `
        L...
        ...R
        .L..
        ..RR   | BR
        ...L   | SS XO
        ..RR   | BR SS
        .L..
        ..R.
        L...
        ...R
      `,
    },
    {
      // mined, with a footswitch out of the bracket
      case: "footswitch",
      bpm: [128, 150],
      pattern: `
        L...
        .R..
        ..L.
        .R..
        ...L   | XO
        M...
        .R.R   | BR SS
        .L..   | FS
        ...R
      `,
    },
  ],
} satisfies FixtureCasesDef
