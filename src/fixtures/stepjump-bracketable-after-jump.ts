import type { FixtureDef } from "../dsl"

// SJ vs BR for pairs sharing a panel with the preceding jump, from Destination beats 216 - 220
export default {
  bpm: [120, 133, 146],
  subdivision: 8,
  patterns: {
    "sj": `
      ...R
      L..r   | SJ
      ..._
      ..Lr   | SJ
      L.._   | DS
      ...r
      ..._
      .L.r   | SJ
      L.._   | DS
      ..r.
      .L_.
      ...R
    `,
    "br": `
      ...R
      L..r   | SJ
      ..._
      ..Rr   | BR
      L.._
      ...r
      ..._
      .R.r   | BR DS
      L.._
      ..r.
      .L_.
      ...R
    `,
    "br-sj": `
      ...R
      L..r   | SJ
      ..._
      ..Rr   | BR
      L.._
      ...r
      ..._
      .L.r   | SJ
      L.._   | DS
      ..r.
      .L_.
      ...R
    `,
  },
} satisfies FixtureDef
