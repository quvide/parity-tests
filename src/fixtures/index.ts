import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { arrowSkeleton, Fixture, FixtureCasesDef, FixtureDef, FixtureVariantDef, preferredPattern } from "../dsl"

// Each fixture lives in its own file here, default-exporting a FixtureDef —
// or a FixtureVariantDef[] when one arrow pattern has several annotated
// interpretations. The fixture's name is its filename, plus `.<variant>` for
// each entry of a variant list.

const dir = fileURLToPath(new URL(".", import.meta.url))

const files = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && f !== "index.ts")
  .sort()

export const FIXTURES: Fixture[] = (
  await Promise.all(
    files.map(async (file): Promise<Fixture[]> => {
      const mod = await import(new URL(file, import.meta.url).href)
      let def: FixtureDef | FixtureVariantDef[] | FixtureCasesDef | undefined = mod.default
      const base = file.replace(/\.ts$/, "")
      if (def && !Array.isArray(def) && "cases" in def) {
        const group = def as FixtureCasesDef
        const seen = new Set<string>()
        return group.cases.map(c => {
          const bpm = c.bpm ?? group.bpm
          const subdivision = c.subdivision ?? group.subdivision
          if (!c.case || bpm === undefined || subdivision === undefined || (typeof c.pattern !== "string" && !Object.keys(c.patterns ?? {}).length)) {
            throw new Error(`fixtures/${file}: each case needs a case name, a pattern, and a bpm and subdivision (own or shared)`)
          }
          if (seen.has(c.case)) throw new Error(`fixtures/${file}: duplicate case "${c.case}"`)
          seen.add(c.case)
          const { case: name, ...rest } = c
          return { name: `${base}.${name}`, ...rest, bpm, subdivision }
        })
      }
      if (Array.isArray(def)) {
        def = def as FixtureVariantDef[]
        const seen = new Set<string>()
        const fixtures = def.map(v => {
          if (typeof v.pattern !== "string" || !v.variant) {
            throw new Error(
              `fixtures/${file}: each variant needs a variant name and a pattern`
            )
          }
          if (seen.has(v.variant)) {
            throw new Error(`fixtures/${file}: duplicate variant "${v.variant}"`)
          }
          seen.add(v.variant)
          const { variant, ...rest } = v
          return { name: `${base}.${variant}`, ...rest }
        })
        // Variants are readings of ONE arrow pattern: their skeletons must be
        // identical, so only feet and tech annotations can differ.
        const ref = arrowSkeleton(def[0].pattern)
        for (let i = 1; i < def.length; i++) {
          const skel = arrowSkeleton(def[i].pattern)
          for (let line = 0; line < Math.max(skel.length, ref.length); line++) {
            if (skel[line] === ref[line]) continue
            throw new Error(
              `fixtures/${file}: variant "${def[i].variant}" arrows differ from ` +
                `"${def[0].variant}" at pattern line ${line}: ` +
                `"${skel[line] ?? "<missing>"}" vs "${ref[line] ?? "<missing>"}"`
            )
          }
        }
        return fixtures
      }
      if (!def || (typeof def.pattern !== "string" && !Object.keys(def.patterns ?? {}).length)) {
        throw new Error(`fixtures/${file}: default export is not a FixtureDef`)
      }
      // Alternative readings share the preferred pattern's arrows.
      const ref = arrowSkeleton(preferredPattern(def))
      for (const [name, pattern] of Object.entries(def.patterns ?? {})) {
        const skel = arrowSkeleton(pattern)
        for (let line = 0; line < Math.max(skel.length, ref.length); line++) {
          if (skel[line] === ref[line]) continue
          throw new Error(
            `fixtures/${file}: reading "${name}" arrows differ from pattern at line ${line}: ` +
              `"${skel[line] ?? "<missing>"}" vs "${ref[line] ?? "<missing>"}"`
          )
        }
      }
      return [{ name: base, ...def }]
    })
  )
).flat()
