import type { FixtureDef } from "../dsl"

// SJ chain vs JU + BR, simplified from Fragmented World beat 128
export default {
  bpm: 150,
  subdivision: 8,
  patterns: {
    "sj": `
      L...
      LR..   | SJ
      .RL.   | SJ
      ..LR   | SJ
      L...
    `,

    "br": `
      L...
      LR..   | SJ
      .LR.   | JU
      ..RR   | BR
      L...
    `,
  },
} satisfies FixtureDef
