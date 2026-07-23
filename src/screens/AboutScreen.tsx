import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { VersionFooter } from '../components/VersionFooter';
import { Card, Divider, Icon, Row, Screen, Text } from '../ds';
import { useDevModeTap } from '../store/useDevModeTap';
import { spacing } from '../theme';

const REPO_URL = 'https://github.com/dirkpostma/heart-rate-ble';
// Same URL the App Store listing declares as the privacy policy.
const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export function AboutScreen({ navigation }: Props) {
  const onCreditTap = useDevModeTap();
  return (
    <Screen scroll footer={<VersionFooter />}>
      <View style={styles.body}>
        <Text>
          Heart Rate BLE shows the live heart rate from your Bluetooth chest strap or sports watch —
          on screen, in a Lock Screen Live Activity, and in a home-screen widget. No account, no
          tracking: your heart rate never leaves your device, and the app collects no data at all.
        </Text>
        <Card>
          <Row
            label="How to connect my device"
            trailing={<Icon name="chevron-right" />}
            onPress={() => navigation.navigate('ConnectHelp')}
          />
          <Divider />
          <Row
            label="Privacy policy"
            trailing={<Icon name="chevron-right" />}
            onPress={() => Linking.openURL(PRIVACY_URL)}
          />
          <Divider />
          <Row
            label="Support & feedback"
            trailing={<Icon name="chevron-right" />}
            onPress={() => Linking.openURL(REPO_URL)}
          />
        </Card>
        <Pressable onPress={() => onCreditTap()}>
          <Text variant="caption">Made by Dirk Postma</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
});
