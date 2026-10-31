import type { FixtureCasesDef } from "../dsl"

// SJ vs BR FS interpretation at 8ths and 16ths
export default {
  subdivision: 16,
  cases: [
    {
      case: "8ths",
      bpm: 150,
      patterns: {
        "sj": `
          L...
          ....
          ...R
          ....
          .L..
          ....
          .L.R   | SJ
          ....
          ..1.
        `,
        "br-fs": `
          L...
          ....
          ...R
          ....
          .L..
          ....
          .R.R   | BR FS
          ....
          ..1.
        `,
      },
    },
    {
      case: "16ths",
      bpm: 150,
      patterns: {
        "br-fs": `
          L...
          ...R
          .L..
          .R.R   | BR FS
          ..1.
        `,
        "sj": `
          L...
          ...R
          .L..
          .L.R   | SJ
          ..1.
        `,
      },
    },
  ],
} satisfies FixtureCasesDef
