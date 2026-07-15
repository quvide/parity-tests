# parity-tests
Test runner for the SMEditor parity engine.
The source code is mostly vibed, except for the fixtures and full charts.

## Usage
Requires local smeditor clone in sibling directory for now.

```sh
# setup
nvm use 22
npm install

# usage
./parity.sh
./parity.sh --help
```

## Features
- Custom DSL for specifying correct parity for minimal test examples
- Checks completely parity-annotated .ssc files
- Mirroring: tests all 4 mirroring permutations for each fixture and full chart
- BPM variations: checks BPM ranges for fixtures, allows specifying a manual scaling factor
- Multithreading