import type { FixtureDef } from "../dsl"

export default {
  description: "MAXIMAL TECHNO stepjumps",
  bpm: [144],
  subdivision: 8,
  pattern: `
    // setup
    ...R
    .L..
    ..R.
    L...
    .R..

    // 1st phrase: 
    .rL. | JA JU
    ....
    L_.. | DS SJ
    ...R

    // 2nd
    ..lR | JA JU
    ....
    .R_. | DS SJ
    L...

    // 3rd
    L.r. | JA JU
    ....
    .L_. | DS SJ
    ...R

    // 4th
    .l.R | JA JU
    ....
    ._R. | DS SJ
    L...

    // 5th (no hold)
    LR.. | JA JU
    .R.. | SJ
    L...
    ...R

    // 6th
    .l.R | JA JU
    ....
    ._R. | DS SJ
    L...

    // 7th
    Lr.. | JA JU
    ....
    ._L. | DS SJ
    ...R

    // 8th (no hold)
    ..LR | JA JU
    ..L. | SJ
    .R..
    L...
  `,
} satisfies FixtureDef
