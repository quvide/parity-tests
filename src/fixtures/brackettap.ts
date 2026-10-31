import type { FixtureCasesDef } from "../dsl"

// Bracket taps: one part taps while the other part holds
export default {
  subdivision: 16,
  cases: [
    {
      case: "simple",
      bpm: 155,
      pattern: `
        L...
        ...R
        lL..   | BR
        ...R
        .L..   | BT
        _..R
      `,
    },
    {
      // BT JA, from Destination beats 264 - 265
      case: "jack",
      bpm: [120, 133, 146],
      pattern: `
        lL..   | BR
        ....
        .L..   | BT JA
        ..R.
        .L..   | BT
        ....
        _...
      `,
    },
    {
      // BT JA vs BT FS, from Destination beats 113 - 116.5
      case: "footswitch-vs-jack",
      bpm: [120, 133, 146],
      pattern: `
        ..Rr   | BR
        ....
        ....
        .L..
        ..R.   | BT
        ....
        L...
        ..M.
        .R..   | BT
        ..L.
        ....
        ..L.   | JA
        .R..   | BT
        ....
        ..._
      `,
    },
    {
      case: "hold",
      bpm: 100,
      subdivision: 8,
      patterns: {
        // probably author intended
        "bt": `
          ...R
          L...
          ..r.
          ....
          .L..
          ...R   | BT
          .._.
        `,
        // alternative but harder
        "ds": `
          ...R
          L...
          ..r.
          ....
          .L..
          ...L   | DS XO
          .._.
        `,
      },
    },
  ],
} satisfies FixtureCasesDef
