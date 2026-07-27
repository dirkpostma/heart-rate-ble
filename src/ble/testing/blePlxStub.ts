/**
 * Runtime stand-in for `@sfourdrinier/react-native-ble-plx` under the
 * bare-node jest config, wired up by `moduleNameMapper` in jest.config.js.
 *
 * The real package is a React Native library that jest cannot parse, which is
 * why `BleHeartRateMonitor` had no tests at all before #165. Only one thing in
 * it is used as a *runtime value* — the `State` enum. `BleManager`, `Device`
 * and `Subscription` are type-only imports, which TypeScript elides at emit.
 *
 * `tsc` still typechecks against the real package (moduleNameMapper is a jest
 * concern, not a compiler one), so the types stay honest. Only module
 * resolution at test runtime is swapped. blePlxStub.test.ts guards the enum
 * values against drifting from the real declaration.
 */
export enum State {
  Unknown = 'Unknown',
  Resetting = 'Resetting',
  Unsupported = 'Unsupported',
  Unauthorized = 'Unauthorized',
  PoweredOff = 'PoweredOff',
  PoweredOn = 'PoweredOn',
}

// Present only so a value-position import of these names cannot explode if
// TypeScript ever stops eliding them. Never constructed by the tests, which
// inject their own fakes through the constructor.
export class BleManager {}
export class Device {}
export type Subscription = { remove: () => void };
