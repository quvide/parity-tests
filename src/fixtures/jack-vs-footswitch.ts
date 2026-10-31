import type { FixtureCasesDef } from "../dsl"

// JA vs FS is ambiguous in this pattern
export default {
  subdivision: 16,
  cases: [
    {
      case: "jack",
      bpm: [60, 100, 140, 160],
      patterns: {
        "jack": `
          ...R
          .L..
          ....
          .L..   | JA
          ..R.
          ....
          ..R.   | JA
          L...
        `,
        "fs": `
          ...R
          .L..
          ....
          .R..   | FS
          ..L.
          ....
          ..R.   | FS
          L...
        `,
      },
    },
    {
      case: "fs",
      bpm: [70, 100, 140, 180],
      patterns: {
        "fs": `
          ...R
          .L..
          .R..   | FS
          ..L.
          ..R.   | FS
          L...
        `,
        "jack": `
          ...R
          .L..
          .L..   | JA
          ..R.
          ..R.   | JA
          L...
        `,
      },
    },
    {
      // a 16th repeat is still a jack when the other foot is needed elsewhere next
      case: "context",
      bpm: [50, 150],
      pattern: `
        L...
        ...R
        ..L.
        ..L.   | JA
        ...R
        .L..
      `,
    },
  ],
} satisfies FixtureCasesDef
