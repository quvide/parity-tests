import type { FixtureDef } from "../dsl"

// SJ DS vs BR FS interpretation from R.I.P. beats 136.5 - 139.5
export default {
  bpm: [172, 192, 212],
  subdivision: 8,
  patterns: {
    "sj": `
      .R..
      ..L.
      ..Lr   | SJ
      L...   | DS
      L.._   | JA
      ...R
      .L..
    `,
    "br-fs": `
      .R..
      ..L.
      ..Rr   | BR FS
      L...
      L.._   | JA
      ...R
      .L..
    `,
  },
} satisfies FixtureDef
