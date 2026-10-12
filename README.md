# tree-sitter-firrtl

[![NPM version](https://img.shields.io/npm/v/tree-sitter-firrtl.svg)](https://www.npmjs.org/package/tree-sitter-firrtl)
[![Build Status](https://github.com/chipsalliance/tree-sitter-firrtl/actions/workflows/ci.yml/badge.svg)](https://github.com/chipsalliance/tree-sitter-firrtl/actions/workflows/ci.yml)
[![Discord](https://img.shields.io/discord/1063097320771698699?logo=discord)](https://discord.gg/w7nTvsVJhm)

[FIRRTL](https://www.chisel-lang.org/firrtl) grammar for [tree-sitter](https://tree-sitter.github.io)

## FIRRTL versions

This fork parses FIRRTL 1.x and the FIRRTL spec 3.x and 4.x syntax:
the `FIRRTL version` header, multi-line `%[...]` annotations, `public`
modules, `enablelayer`/`knownlayer`, `extmodule` `ref` and `requires`,
`intmodule`, `layer`/`layerblock` (and the 3.0 `declgroup`/`group`),
`formal`, `type` aliases, `connect`/`invalidate`/`define`/`propassign`,
`regreset`, probes (`probe`, `rwprobe`, `read`, `force*`, `release*`),
`intrinsic` statements and expressions, enums and `match`, property
types and literals, radix integer literals, literal identifiers, and
named commands (`printf(...) : name`). It also accepts the CIRCT
`option`/`instchoice` declarations and the 5.x/6.x `class`, `extclass`,
`object`, `fprintf`, `fflush` and `propassert` forms.

The rules follow the "Grammar" section of the FIRRTL specification
(chipsalliance/firrtl-spec, v3.3.0 and v4.2.0). Corpus tests in
`test/corpus/firrtl3.txt` are hand-written.

Known limit: a FIRRTL 1.x signal whose name is a 3.x statement keyword
(`connect`, `match`, `group`, ...) cannot start a `<=` connect.
