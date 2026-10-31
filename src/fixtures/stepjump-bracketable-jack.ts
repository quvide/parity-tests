import type { FixtureDef } from "../dsl"

// SJ vs BR FS JA interpretation of a repeating pattern from きゅうくらりん
export default {
  bpm: 220,
  subdivision: 8,
  patterns: {
    "sj": `
      .R..
      ....
      ..L.
      ..LR   | SJ
      ....
      ...R
      L...
    `,
    "br-fs": `
      .R..
      ....
      ..L.
      ..RR   | BR FS
      ....
      ...R   | JA
      L...
    `,
  },
} satisfies FixtureDef
