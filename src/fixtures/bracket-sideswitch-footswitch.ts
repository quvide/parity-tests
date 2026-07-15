import type { FixtureDef } from "../dsl"

export default {
  bpm: [128, 150],
  subdivision: 16,
  pattern: `
    L...
    .R..
    ..L.
    .R..
    ...L   | XO
    M...
    .R.R   | BR SS
    .L..   | FS
    ...R
    .L..
    ..R.
    .L..
    R...   | XO
    ...M
    LL..   | BR SS
    .R..   | FS
    l...
    ....
    _..R
  `,
} satisfies FixtureDef
