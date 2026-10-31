import type { FixtureDef } from "../dsl"

// MAXIMAL TECHNO stepjumps
export default {
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
    .rL. | SJ
    ....
    L_.. | DS
    ...R

    // 2nd
    ..lR | SJ
    ....
    .R_.
    L...

    // 3rd
    L.r. | SJ
    ....
    .L_.
    ...R

    // 4th
    .l.R | SJ
    ....
    ._R. | DS
    L...

    // 5th (no hold)
    LR.. | SJ
    .R..
    L...
    ...R

    // 6th
    .l.R | SJ
    ....
    ._R.
    L...

    // 7th
    Lr.. | SJ
    ....
    ._L.
    ...R

    // 8th (no hold)
    ..LR | SJ
    ..L. | JA
    .R..
    L...
  `,
} satisfies FixtureDef
