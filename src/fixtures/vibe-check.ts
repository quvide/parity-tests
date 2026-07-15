import type { FixtureDef } from "../dsl"

export default {
  description: "Complex XO-SS-BR-FS patterns from VIBE_CHECK",
  bpm: [128, 150],
  subdivision: 16,
  pattern: `
    L...
    .R..
    ...L   | XO
    ...R   | SS
    L...
    .R.R   | BR
    .L..   | FS
    ..R.
    .l..
    ....
    R_..   | XO
    L...   | SS
    ...R
    LL..   | BR
    .R..   | FS
    L...
    
    // pattern 2
    ...R
    L.L.   | BR
    .R..
    .L..   | FS
    ...r
    ....
    L.._
    ..R.
    ...L   | XO
    ...R   | SS
    LL..   | BR
    .R..   | FS
    L...
  `,
} satisfies FixtureDef
