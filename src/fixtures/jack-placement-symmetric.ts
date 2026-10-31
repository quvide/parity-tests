import type { FixtureDef } from "../dsl"

// JA vs FS placement, from MAXIMAL TECHNO beats 288.25 - 290.75
// Late jack is preferred (alternate as long as it makes sense)

export default {
  bpm: 144,
  subdivision: 16,
  patterns: {
    "jack-late": `
      ..l.
      ....
      .._R
      ..L.
      .R..
      .L..   | FS
      R...   | XO
      .L..
      ..R.
      L...
      ..R.
      .L..
      .L..   | JA
      ...R
    `,
    "jack-early": `
      ..l.
      ....
      .._R
      ..L.
      .R..
      .R..   | JA
      L...
      .R..
      ..L.
      R...   | XO
      ..L.
      .R..
      .L..   | FS
      ...R
    `,
  },
} satisfies FixtureDef
