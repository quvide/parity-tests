// ParityInternals.ts installs `self.onmessage` at module scope (web worker
// entry). Provide the globals so it can be imported under Node.
const g = globalThis as any
if (g.self === undefined) g.self = g
if (g.postMessage === undefined) g.postMessage = () => {}
export {}
