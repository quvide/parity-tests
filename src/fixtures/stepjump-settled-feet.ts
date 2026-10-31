import type { FixtureDef } from "../dsl"

// SJ vs BR with both feet already on the pair's panels, from Destination beats 103.5 - 109
export default {
  bpm: [125, 133, 150],
  subdivision: 8,
  patterns: {
    "sj": `
      .R..
      l...
      _...
      lR..   | SJ
      ....
      _..r   | DS
      ..._
      .L.r   | SJ
      ..._
      l...   | DS
      ....
      _...
    `,
    "br": `
      .R..
      l...
      _...
      lR..   | SJ
      ....
      _..r   | DS
      ..._
      .R.r   | BR DS
      ..._
      l...
      ....
      _...
    `,
  },
} satisfies FixtureDef
