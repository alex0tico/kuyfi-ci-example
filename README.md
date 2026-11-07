# kuyfi-ci-example

A tiny Soroban contract (`contracts/splitter`, ours, Testnet only) and a GitHub
Actions workflow that audits it with [Kuyfi](https://github.com/alex0tico/kuyfi)
on every push. Nothing is hard-coded: each run deploys a fresh contract, no
secrets are used, and the JSON report is uploaded as a downloadable artifact.

The same source builds twice. The default build validates its divisor; the
`vulnerable` feature does not, so `share(total, 0)` traps instead of returning
an error.

| Job | Contract | Result |
|---|---|---|
| `clean-contract-passes` | default build | exit `0`, gates passed |
| `vulnerable-contract-is-blocked` | `--features vulnerable` | exit `2`, `--fail-on` blocks |

`kuyfi.config.json` holds the seed, limits and gates (`failOn`, `failOnIncomplete`,
`timeout`). Exit codes: `0` ok, `1` tool error, `2` `--fail-on`, `3` incomplete.

## Run it locally

Needs Node 20+, Rust with the `wasm32v1-none` target, and Kuyfi on your `PATH`.

```sh
npm ci
cargo build --release --target wasm32v1-none -p splitter   # add: --features vulnerable
ID=$(node scripts/deploy.mjs target/wasm32v1-none/release/splitter.wasm)
kuyfi "$ID" --config kuyfi.config.json --json
echo $?
```
