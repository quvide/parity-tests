import type { FixtureDef } from "../dsl"

// Somewhat hard-to-interpret pattern from XXXX GiRL. 
// L holds LU and brackettaps L on the same row as R brackets DR.
export default {
  bpm: 155,
  subdivision: 16,
  pattern: `
    L...
    ...R
    L.l.   | BR
    ....
    ....
    ....
    Lr.R   | BR BT JU
    ....
    .._.
    ....
    ._L.
    .R..
    L...
    ...R
  `,
} satisfies FixtureDef
