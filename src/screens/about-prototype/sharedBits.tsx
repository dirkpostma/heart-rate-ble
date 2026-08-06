import { Linking, Switch } from 'react-native';
import { Divider, Icon, Row, useTheme } from '../../ds';

// PROTOTYPE ONLY — tiny shared pieces that don't dictate layout hierarchy.
// Variants still own sectioning, order, and copy.

export const REPO_URL = 'https://github.com/dirkpostma/heart-rate-ble';
export const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`;

export function ThemedSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: theme.accent, false: theme.border }}
      thumbColor={theme.onAccent}
    />
  );
}

export function LinkRows({
  onConnectHelp,
  onStorybook,
  includeStorybook,
}: {
  onConnectHelp: () => void;
  onStorybook?: () => void;
  includeStorybook?: boolean;
}) {
  return (
    <>
      <Row
        label="How to connect my device"
        trailing={<Icon name="chevron-right" />}
        onPress={onConnectHelp}
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
      {includeStorybook && onStorybook && (
        <>
          <Divider />
          <Row
            label="Storybook"
            trailing={<Icon name="chevron-right" />}
            onPress={onStorybook}
          />
        </>
      )}
    </>
  );
}
