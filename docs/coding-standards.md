# Coding standards

The rules an agent writing code in this repo is held to. Decided in
[#157](https://github.com/dirkpostma/heart-rate-ble/issues/157).

Nothing here is invented. Every rule is either a decision already locked in an
issue or a convention the codebase already follows — most of them written down
because the [quality audit](https://github.com/dirkpostma/heart-rate-ble/issues/148)
caught the repo breaking its own conventions in exactly these places.

This doc is for judgment a linter can't encode. Formatting, import order and
file length are not here: `npm run lint` owns what it owns, and the rest is
deliberately unregulated.

---

## Module shape

Locked by [#150](https://github.com/dirkpostma/heart-rate-ble/issues/150).

**Screens are rendering-only.** No timing rules, no truth tables. Extract them
to a plain `.ts` module and choose its home by *subject*, not convenience: a
signal-staleness rule belongs beside the store's other timing rules
(`store/signalPresence.ts`), a scan-status label table belongs beside its screen
(`screens/scanStatus.ts`). The test for "is this logic?" is simple — if you
could get it wrong in a way a unit test would catch, it isn't markup.

**Accept dependencies; don't construct them.** `BleHeartRateMonitor(manager,
appState)`, `createHeartRateStore(sources)`. A module that news-up its own
collaborators is untestable by construction — that single mistake made 283 lines
of the hardest-won BLE logic in this project unreachable by any test.

**Composition happens in `src/app/`, and importing is free of side effects.**
No module-level work on import. The old `appStore.ts` built the whole object
graph — including a native `BleManager` — as an import side effect, which meant
importing *any* screen booted the BLE stack and no screen could be loaded under
jest at all.

**`index.ts` only where a folder hides internals.** `ds/` and `demo/` have one.
Everywhere else the files are the public surface and an index would be a
pass-through that just costs a hop.

**Split an interface by who can call it.** If no screen could ever supply a
member's arguments, that member doesn't belong on the UI-facing interface.
`HeartRateState` is what a screen can invoke; `HeartRateComposition` (`adopt`,
`destroy`) is what only the composition root and tests can.

**Prefer one listener object over a growing positional callback list.**
`startScan({ onDevice, onError, onScanStarted? })`. Optional members document
that one implementation's quirk isn't every implementation's concern.

## Naming

**One name per distinct value.** Two constants sharing a name with different
values in different files is a grep trap — a maintainer or agent fixing "the
stale threshold" has a coin-flip chance of hitting the wrong one. `STALE_AFTER_MS`
was 5000 in a screen and 20000 in the driver; they are now `SIGNAL_STALE_MS`,
`ACTIVITY_STALE_AFTER_MS` and `DEVICE_STALE_MS`.

**Names say what a thing is.** `appStore.ts` was a composition root.
`components/` held one whole feature and three glyphs. Both misled every reader
who trusted them, agents worst of all — the name at the top of the tree is the
first thing read and the last thing questioned.

## Comments

This is the repo's most distinctive convention and the main reason a cold reader
can navigate it. Keep it.

**Comments explain _why_, and cite the issue that forced it.** `(#118)`,
`(#134)`, `(#47)`. The code already says what it does; the comment carries the
reason it can't be simpler — usually a bug, a platform quirk, or a decision that
looks arbitrary until you know what broke.

**Never comment what the next line does.** That's talking to the reviewer, not
to the next reader, and it's noise the moment the PR merges.

**A workaround records its expiry condition, not just its existence.** "Remove
once the fork drops the flags upstream" is useful; "workaround for a bug" is
not. When the condition changes, update the comment — a stale expiry pointer is
how `withBlePlxStripCxxModules` ended up citing a closed issue while still being
required.

## Tests

Locked by [#151](https://github.com/dirkpostma/heart-rate-ble/issues/151).

**Colocate**: `foo.test.ts` beside `foo.ts`.

**Hand-write fakes; never `jest.mock`** ([#11](https://github.com/dirkpostma/heart-rate-ble/issues/11)).
Fakes are injected through the seam the production code already has. If faking
something requires module mocking, the missing seam is the actual bug.

**A new pure-logic module ships with its tests.** No react-native import means
it runs under the bare-node jest config today, so there is no excuse.

**A pure-logic bug fix ships with the regression test that fails before the
fix**, and the test cites the issue number.

Not required: tests for `.tsx` markup, for thin forwarding adapters
(`nativeSurfaces.ts`), or for config. There is deliberately **no coverage
percentage** — it rewards trivial tests and punishes deletion.

## Verification

Locked by [#152](https://github.com/dirkpostma/heart-rate-ble/issues/152).

```sh
npm run verify          # typecheck && lint && test — before every PR
npm run verify:native   # additionally, when targets/ or modules/*/ios/ is touched
```

CI runs `npm run verify` and blocks merge. The native rungs are local-only and
enforced by this contract rather than by a bot — if you touch native, run them
and say so in the PR.

## Process

All changes go through a branch and a PR, docs included — never a direct push to
`main`.
