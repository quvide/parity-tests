import type { FixtureDef } from "../dsl"

// DS vs BT interpretations
export default {
  bpm: 150,
  subdivision: 8,
  patterns: {
    "ds": `
      ...R
      l...
      .R..
      ...R   | DS
      _...
      .L..
    `,
    "bt": `
      ...R
      l...
      .L..   | BT DS
      ...R
      _...
      .L..
    `,
  },
} satisfies FixtureDef
