import type { FixtureCasesDef } from "../dsl"

// Footswitches at 16ths, alone, repeated and mined
export default {
  bpm: [125, 150, 175, 200],
  subdivision: 16,
  cases: [
    {
      case: "single",
      pattern: `
        L...
        ..R.
        ..L.   | FS
        ...R
      `,
    },
    {
      case: "double",
      pattern: `
        ...R
        .L..
        .R..   | FS
        .L..   | FS
        ...R
      `,
    },
    {
      case: "triple",
      pattern: `
        ...R
        .L..
        .R..   | FS
        .L..   | FS
        .R..   | FS
        L...
      `,
    },
    {
      case: "mine",
      pattern: `
        L...
        ..R.
        .M..
        ..L.   | FS
        ...R
      `,
    },
  ],
} satisfies FixtureCasesDef
