import type { FixtureDef } from "../dsl"

export default {
  bpm: 100,
  subdivision: 8,
  pattern: `
    l...
    .R..
    ..R.   | DS
    .R..   | DS
    _...
  `,
} satisfies FixtureDef
