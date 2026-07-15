import type { FixtureDef } from "../dsl"

export default {
  bpm: 100,
  subdivision: 8,
  pattern: `
    L...
    ...R
    .l..
    ....
    ..RR   | BR
    ....
    ._..
  `,
} satisfies FixtureDef
