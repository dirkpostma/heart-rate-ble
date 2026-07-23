import AsyncStorage from '@react-native-async-storage/async-storage';
import { view } from './storybook.requires';

// The on-device Storybook UI (navigator + controls + canvas), rendered in
// the real RN renderer. Unlike a stock RN Storybook app this is NOT the
// registered root component — it mounts as a full-screen nav route reached
// from the dev-mode Storybook row in the demo panel (#85/#88), so the app
// and its stories share one bundle. AsyncStorage persists the last-viewed
// story across launches.
const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});

export default StorybookUIRoot;
