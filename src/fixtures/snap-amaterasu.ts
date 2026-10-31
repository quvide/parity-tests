import type { FixtureCasesDef } from "../dsl"

// BT FS and BT SS phrases from Snap - Amaterasu
export default {
  subdivision: 16,
  cases: [
    {
      case: "footswitch",
      bpm: 155,
      pattern: `
        L...
        ...R
        l.L. | BR
        ....
        ...R
        ..L. | BT
        _R.r | BR
        ....
        ..L.
        .R.. | BT
        ..M. // just a stylistic, optional FS indicator
        .L.. | FS // R heel moves to R-panel and ready to BT U-panel next row
        ..R. | BT
        ..._
        LL.. | BR
      `,
    },
    {
      case: "sideswitch",
      bpm: 150,
      pattern: `
        L.l. | BR
        ....
        ...R
        L... | BT
        .R..
        L... | BT
        ...M          // actually a 32nd
        R... | XO SS
        ...M          // actually a 32nd
        L... | BT SS
        .R_.
      `,
    },
  ],
} satisfies FixtureCasesDef
