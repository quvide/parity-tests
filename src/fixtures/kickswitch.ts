import type { FixtureCasesDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  cases: [
    {
      case: "plain",
      pattern: `
        ..r.
        L...
        .._.
        M.L.   | KS
        ...R
      `,
    },
    {
      // from PUSH UR T3MPRR
      case: "bracket",
      pattern: `
        ..l.
        .R.R   | BR
        .._.
        ..RM   | KS
        LL..   | BR
      `,
    },
  ],
} satisfies FixtureCasesDef
