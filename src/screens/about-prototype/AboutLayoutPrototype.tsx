import { useState } from 'react';
import { View } from 'react-native';
import { useDevMode } from '../../store/devModeStore';
import { PrototypeSwitcher, type PrototypeVariant } from './PrototypeSwitcher';
import { VariantA } from './VariantA';
import { VariantB } from './VariantB';
import { VariantC } from './VariantC';

// PROTOTYPE for wayfinder #180 — About screen layout with a Settings section.
// Question: what does About look like once it carries Settings + Storybook?
// Three structurally different variants on the real About route; flip with the
// floating bar. In-memory demo flag only — persistence is decided elsewhere.
// Throwaway branch: prototype/about-settings-layout-180

const VARIANTS: PrototypeVariant[] = [
  { key: 'A', name: 'Grouped Settings first' },
  { key: 'B', name: 'One mixed card' },
  { key: 'C', name: 'Links first + strip' },
];

type Props = {
  onConnectHelp: () => void;
  onCreditTap: () => void;
};

export function AboutLayoutPrototype({ onConnectHelp, onCreditTap }: Props) {
  const [variantKey, setVariantKey] = useState('A');
  // Local only — not the real preferencesStore (that ticket is closed elsewhere).
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const devModeEnabled = useDevMode((s) => s.enabled);
  const toggleDev = useDevMode((s) => s.toggle);
  const setStorybookActive = useDevMode((s) => s.setStorybookActive);

  const shared = {
    demoModeEnabled,
    onDemoModeChange: setDemoModeEnabled,
    devModeEnabled,
    onConnectHelp,
    onStorybook: () => setStorybookActive(true),
    onCreditTap,
  };

  return (
    <View style={{ flex: 1 }}>
      {variantKey === 'A' && <VariantA {...shared} />}
      {variantKey === 'B' && <VariantB {...shared} />}
      {variantKey === 'C' && <VariantC {...shared} />}
      <PrototypeSwitcher
        variants={VARIANTS}
        currentKey={variantKey}
        onChange={setVariantKey}
        stateLine={`demo=${demoModeEnabled ? 'on' : 'off'} · dev=${devModeEnabled ? 'on' : 'off'}`}
        onCycleDemoMode={() => setDemoModeEnabled((v) => !v)}
        onCycleDevMode={toggleDev}
      />
    </View>
  );
}
