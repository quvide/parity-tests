import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Fixture, FixtureDef } from "../dsl"

// Each fixture lives in its own file here, default-exporting a FixtureDef.
// The fixture's name is its filename.

const dir = fileURLToPath(new URL(".", import.meta.url))

const files = readdirSync(dir)
  .filter(f => f.endsWith(".ts") && f !== "index.ts")
  .sort()

export const FIXTURES: Fixture[] = await Promise.all(
  files.map(async file => {
    const mod = await import(new URL(file, import.meta.url).href)
    const def: FixtureDef | undefined = mod.default
    if (!def || typeof def.pattern !== "string") {
      throw new Error(`fixtures/${file}: default export is not a FixtureDef`)
    }
    return { name: file.replace(/\.ts$/, ""), ...def }
  })
)
