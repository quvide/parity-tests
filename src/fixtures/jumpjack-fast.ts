import type { FixtureDef } from "../dsl"

export default {
  description: "Repeated L+R jump at 16th spacing is a jump-jack",
  bpm: 150,
  subdivision: 16,
  pattern: `
    L..R
    L..R   | JA JU
  `,
} satisfies FixtureDef
