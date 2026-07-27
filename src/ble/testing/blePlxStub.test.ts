import { readFileSync } from 'node:fs';
import { State } from './blePlxStub';

const DECLARATION =
  'node_modules/@sfourdrinier/react-native-ble-plx/lib/typescript/src/TypeDefinition.d.ts';

/**
 * The stub only earns its keep if it matches reality. `BleHeartRateMonitor`
 * compares Bluetooth adapter states against these exact strings, so a silent
 * drift would make every scan-state-machine test pass against a fiction.
 *
 * The real package can't be imported here (that's the whole reason the stub
 * exists), so read its type declaration as text instead.
 */
describe('blePlxStub State', () => {
  const declaredMembers = () => {
    const source = readFileSync(DECLARATION, 'utf8');
    const block = /export declare enum State \{([\s\S]*?)\n\}/.exec(source);
    if (!block) throw new Error(`could not find the State enum in ${DECLARATION}`);
    return Object.fromEntries(
      [...block[1].matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]]),
    );
  };

  it('matches the real enum member-for-member', () => {
    expect({ ...State }).toEqual(declaredMembers());
  });

  // The four the scan state machine actually branches on. Named explicitly so
  // that removing one upstream fails here rather than silently disabling a
  // branch of BleHeartRateMonitor.startScan.
  it.each(['PoweredOn', 'PoweredOff', 'Unsupported', 'Unauthorized'])(
    'still declares %s, which startScan branches on',
    (member) => {
      expect(declaredMembers()[member]).toBe(member);
    },
  );
});
