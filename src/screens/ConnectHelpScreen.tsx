import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Fragment, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../../App';
import { connectHelpSections, type HelpSection } from '../content/connectHelp';
import { colors, spacing } from '../theme';

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.body}
    >
      <Text style={styles.lede}>
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
              <Text style={styles.groupHeading}>{section.group}</Text>
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
    </ScrollView>
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
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.title}>{section.title}</Text>
        <Text style={styles.chevron}>{open ? '⌄' : '›'}</Text>
      </Pressable>
      {open && (
        <View style={styles.content}>
          {section.intro && <Text style={styles.intro}>{section.intro}</Text>}
          {section.steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          {section.note && <Text style={styles.note}>{section.note}</Text>}
          {section.support && (
            <Pressable
              onPress={() => Linking.openURL(SUPPORT_URL)}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.supportLink}>{section.support}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  lede: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  groupHeading: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  card: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    color: colors.textDim,
    fontSize: 20,
    marginLeft: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNumber: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    width: 18,
    lineHeight: 21,
  },
  stepText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  note: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  supportLink: {
    color: colors.accent,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
