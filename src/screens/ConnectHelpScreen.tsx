import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Fragment, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { connectHelpSections, type HelpSection } from '../content/connectHelp';
import { Card, Icon, Row, Screen, Text } from '../ds';
import { spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectHelp'>;

// Where "get in touch" goes — the repo, matching the Support & feedback link
// on the About screen (issue #67 settled support = repo URL).
const SUPPORT_URL = 'https://github.com/dirkpostma/heart-rate-ble';

// "How to connect my device" — bundled help organized type-first (device-type
// group headings) with brands nested as collapsible cards of short numbered
// steps. Content comes from src/content/connectHelp.ts so copy edits ride an
// EAS Update.
export function ConnectHelpScreen(_props: Props) {
  // First section open by default so the screen isn't a wall of closed rows.
  const [openId, setOpenId] = useState<string | null>(
    connectHelpSections[0]?.id ?? null,
  );

  return (
    <Screen scroll>
      <View style={styles.body}>
        <Text color="textSecondary" style={styles.lede}>
          This app only sees sensors that broadcast standard Bluetooth heart rate.
          Find your device type below and follow the steps to start broadcasting.
        </Text>
        {connectHelpSections.map((section, index) => {
          // Render a group heading only at the first section of each group, so
          // consecutive Garmin/Polar cards sit under one "Sports watches" head.
          const prevGroup = connectHelpSections[index - 1]?.group;
          return (
            <Fragment key={section.id}>
              {section.group && section.group !== prevGroup && (
                <Text variant="caption" caps weight="bold" style={styles.groupHeading}>
                  {section.group}
                </Text>
              )}
              <SectionCard
                section={section}
                open={openId === section.id}
                onToggle={() =>
                  setOpenId((current) =>
                    current === section.id ? null : section.id,
                  )
                }
              />
            </Fragment>
          );
        })}
      </View>
    </Screen>
  );
}

function SectionCard({
  section,
  open,
  onToggle,
}: {
  section: HelpSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Row
        label={section.title}
        variant="title"
        trailing={<Icon name={open ? 'chevron-down' : 'chevron-right'} />}
        onPress={onToggle}
        accessibilityState={{ expanded: open }}
      />
      {open && (
        <View style={styles.content}>
          {section.intro && (
            <Text variant="caption" style={styles.intro}>
              {section.intro}
            </Text>
          )}
          {section.steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <Text variant="body" weight="bold" color="accent" style={styles.stepNumber}>
                {index + 1}
              </Text>
              <Text variant="body" style={styles.stepText}>
                {step}
              </Text>
            </View>
          ))}
          {section.note && (
            <Text variant="caption" style={styles.note}>
              {section.note}
            </Text>
          )}
          {section.support && (
            <Text
              variant="body"
              weight="semibold"
              color="accent"
              onPress={() => Linking.openURL(SUPPORT_URL)}
              style={styles.supportLink}
            >
              {section.support}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  lede: {
    marginBottom: spacing.sm,
  },
  groupHeading: {
    marginTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    marginBottom: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 18,
  },
  stepText: {
    flex: 1,
  },
  note: {
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  supportLink: {
    marginTop: spacing.xs,
  },
});
