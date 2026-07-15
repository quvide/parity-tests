import type { FixtureDef } from "../dsl"

export default {
  bpm: 150,
  subdivision: 16,
  pattern: `
  // single
    L...
    ..R.
    ..L.   | FS
    ...R
  // double
    .L..
    .R..   | FS
    .L..   | FS
    ...R
  // triple
    .L..
    .R..   | FS
    .L..   | FS
    .R..   | FS
    L...
  // with a mine
    ..R.
    .M..
    ..L.   | FS
    ...R
  `,
} satisfies FixtureDef
