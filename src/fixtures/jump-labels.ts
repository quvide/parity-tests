import type { FixtureCasesDef } from "../dsl"

// Labels on and after jumps. JU: both feet moved; SJ: one foot moved, the
// other re-pressed (a re-press is not a move); a repeated jump is JU only.
export default {
  bpm: 150,
  subdivision: 8,
  cases: [
    {
      case: "repeat",
      bpm: 120,
      pattern: `
        L..R   | JU
        .11.   | JU
        L..R   | JU
        L..R   | JU
      `,
    },
    {
      case: "stepjump",
      bpm: 120,
      pattern: `
        .L..
        L..R   | SJ
        L...
        L..R   | SJ
      `,
    },
    {
      // Unmined repeat on a side panel is a jack, not a sideswitch
      case: "side-jack",
      bpm: 120,
      pattern: `
        .11.   | JU
        L...
        L...   | JA
        .11.   | JU
      `,
    },
    {
      case: "simple",
      pattern: `
        L...
        L..R | SJ
        ...R
      `
    },
    {
      // Both feet travel into the jump and out -> no extra annotation
      case: "travel",
      pattern: `
        ...R
        L...
        .11.   | JU
        L...
        ...R
        .11.   | JU
        ...R
        L...
      `,
    },
    {
      // L foot moves 2 times in a row -> DS
      case: "mover",
      pattern: `
        L...
        .R..
        .RL.   | SJ
        L...   | DS
        ...R
      `,
    },
    {
      // L moves into SJ, R moves out -> no extra annotation
      case: "planted",
      pattern: `
        L...
        .R..
        .RL.   | SJ
        ...R
        L...
      `,
    },
    {
      // L moves into SJ, R presses same panel again -> JA
      case: "planted-jack",
      pattern: `
        L...
        .R..
        .RL.   | SJ
        .R..   | JA
        L...
      `,
    },
    {
      // L keeps its bracket through the jump and re-presses one of its panels -> JA
      case: "bracket-repress",
      pattern: `
        ...R
        LL..   | BR
        LLR.   | BR JU
        .L..   | JA
        ...R
      `,
    },
  ],
} satisfies FixtureCasesDef
