import type { FixtureDef } from "../dsl"

export default {
  description: "Unmined repeat on a side panel is a jack, not a sideswitch",
  bpm: 120,
  subdivision: 8,
  pattern: `
    .11.
    L...
    L...   | JA
    .11.   | JU
  `,
} satisfies FixtureDef
