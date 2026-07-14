import { requireOptionalNativeModule } from 'expo-modules-core';

interface LiveActivityNativeModule {
  isSupported(): boolean;
  start(deviceName: string, bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  update(bpm: number, timestampMs: number, staleDateMs: number): Promise<void>;
  end(): Promise<void>;
}

// null on Android and anywhere else the native module isn't compiled in;
// every call below then no-ops, mirroring ExtensionStorage's behavior.
const native = requireOptionalNativeModule<LiveActivityNativeModule>('LiveActivity');

export const liveActivity = {
  isSupported(): boolean {
    return native?.isSupported() ?? false;
  },
  async start(
    deviceName: string,
    bpm: number,
    timestampMs: number,
    staleDateMs: number,
  ): Promise<void> {
    await native?.start(deviceName, bpm, timestampMs, staleDateMs);
  },
  async update(bpm: number, timestampMs: number, staleDateMs: number): Promise<void> {
    await native?.update(bpm, timestampMs, staleDateMs);
  },
  async end(): Promise<void> {
    await native?.end();
  },
};
