import { AppState } from 'react-native';
import { AppStateReader } from '../ble/BleHeartRateMonitor';

/** The real AppStateReader adapter: react-native's AppState. */
export const reactNativeAppState: AppStateReader = {
  isActive: () => AppState.currentState === 'active',
};
