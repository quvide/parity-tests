import type { FixtureCasesDef } from "../dsl"

// The free foot brackets while the other holds
export default {
  subdivision: 8,
  cases: [
    {
      case: "free",
      bpm: 100,
      pattern: `
        L...
        ...R
        .l..
        ....
        ..RR   | BR
        ....
        ._..
      `,
    },
    {
      // after its own single the bracket is a doublestep
      case: "doublestep",
      bpm: 150,
      subdivision: 16,
      pattern: `
        l...
        ...R
        ..RR   | BR DS
        _...
      `,
    },
  ],
} satisfies FixtureCasesDef
