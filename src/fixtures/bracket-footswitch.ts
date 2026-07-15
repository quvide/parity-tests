import type { FixtureDef } from "../dsl"

export default {
  description: "Bracket footswitch from XXXX Girl",
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
