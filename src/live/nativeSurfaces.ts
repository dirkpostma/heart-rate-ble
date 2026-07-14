import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { liveActivity } from '../../modules/live-activity';
import { LiveActivitySurface, WidgetReading, WidgetSurface } from './liveSurfaceDriver';

const APP_GROUP = 'group.dev.dirkpostma.heartrateble';
// Read by targets/widgets/HeartRateWidget.swift — a JSON string, so both
// sides agree on the encoding rather than on UserDefaults dictionary shapes.
const READING_KEY = 'latestReading';

/**
 * The real surfaces behind the driver: ActivityKit via the local Expo
 * module, the widget via app-group storage. null where the surfaces don't
 * exist (Android) — the driver is simply never attached there.
 */
export function createNativeSurfaces(): {
  activity: LiveActivitySurface;
  widget: WidgetSurface;
} | null {
  if (Platform.OS !== 'ios') return null;
  const storage = new ExtensionStorage(APP_GROUP);
  return {
    // A denied Live Activity (user setting, or the 8 h ceiling already
    // spent) must never take the BLE session down with it.
    activity: {
      async start(deviceName, bpm, timestampMs, staleDateMs) {
        try {
          await liveActivity.start(deviceName, bpm, timestampMs, staleDateMs);
        } catch (cause) {
          console.warn('Live Activity start failed', cause);
        }
      },
      async update(bpm, timestampMs, staleDateMs) {
        try {
          await liveActivity.update(bpm, timestampMs, staleDateMs);
        } catch (cause) {
          console.warn('Live Activity update failed', cause);
        }
      },
      async end() {
        try {
          await liveActivity.end();
        } catch (cause) {
          console.warn('Live Activity end failed', cause);
        }
      },
    },
    widget: {
      write(reading: WidgetReading) {
        storage.set(READING_KEY, JSON.stringify(reading));
      },
      reload() {
        ExtensionStorage.reloadWidget();
      },
    },
  };
}
