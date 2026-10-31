import type { FixtureDef } from "../dsl"

// Bracket footswitch from XXXX GiRL
export default {
  bpm: 155,
  subdivision: 16,
  pattern: `
    ...R
    L...
    ...R
    ..L.
    .R.r   | BR
    lL..   | BR FS
    ..._
    _..R
  `,
} satisfies FixtureDef
