import type { FixtureDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
    // regular
    ..r.
    L...
    .._.
    M.L. | KS
    ...R

    // BR KS from PUSH UR T3MPRR
    ..l.
    .R.R | BR
    .._.
    ..RM | KS
    LL.. | BR
  `,
} satisfies FixtureDef
