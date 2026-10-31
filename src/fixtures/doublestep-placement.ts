import type { FixtureCasesDef } from "../dsl"

// Early vs late placement of a forced DS; the continuation decides
export default {
  bpm: 150,
  subdivision: 8,
  cases: [
    {
      case: "early",
      patterns: {
        "ds-early": `
          L...
          ...R
          .R..   | DS
          L...
          .R..
          ..L.
          ...R
        `,
        "ds-late": `
          L...
          ...R
          .L..
          L...   | DS
          .R..
          ..L.
          ...R
        `,
      },
    },
    {
      case: "late",
      patterns: {
        "ds-late": `
          L...
          ...R
          .L..
          L...   | DS
          ...R
          .L..
        `,
        "ds-early": `
          L...
          ...R
          .R..   | DS
          L...
          ...R
          .L..
        `,
      },
    },
  ],
} satisfies FixtureCasesDef
