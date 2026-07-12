/**
 * PROTOTYPE — throwaway. Three variants of the demo control surface (#17),
 * cycled via the floating bar at the bottom. Stub in-memory devices only;
 * nothing here touches the store or the seam.
 *
 *   A — long-press the version footer  → bottom sheet
 *   B — shake gesture                  → full-screen console
 *   C — persistent corner dot          → compact floating panel
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

// ---------------------------------------------------------------- stub state

type DemoProfile = 'resting' | 'workout' | 'dropout';

type StubDevice = {
  id: string;
  name: string;
  profile: DemoProfile;
  bpm: number;
  advertising: boolean;
  connected: boolean;
  age: number; // ticks since summoned, drives the dropout cycle
};

const PROFILES: Record<DemoProfile, { label: string; blurb: string; start: number }> = {
  resting: { label: 'Resting', blurb: 'steady 55–75 BPM', start: 62 },
  workout: { label: 'Workout', blurb: 'erratic 95–175 BPM', start: 142 },
  dropout: { label: 'Dropout-prone', blurb: 'signal cuts out every ~20 s', start: 71 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function walk(d: StubDevice): number {
  const step = d.profile === 'workout' ? 6 : 2;
  const next = d.bpm + Math.round((Math.random() * 2 - 1) * step);
  if (d.profile === 'workout') return clamp(next, 95, 175);
  if (d.profile === 'resting') return clamp(next, 55, 75);
  return clamp(next, 62, 80);
}

const seed: StubDevice[] = [
  { id: 'demo-1', name: 'Demo HRM 1', profile: 'resting', bpm: 62, advertising: true, connected: true, age: 0 },
  { id: 'demo-2', name: 'Demo HRM 2', profile: 'workout', bpm: 148, advertising: true, connected: false, age: 0 },
  { id: 'demo-3', name: 'Demo HRM 3', profile: 'dropout', bpm: 71, advertising: false, connected: false, age: 18 },
];

function useStubDevices() {
  const [devices, setDevices] = useState<StubDevice[]>(seed);
  const counter = useRef(seed.length);

  useEffect(() => {
    const t = setInterval(() => {
      setDevices((list) =>
        list.map((d) => {
          const age = d.age + 1;
          // dropout profile: advertising off for 5 s out of every 25 s
          const advertising = d.profile === 'dropout' ? age % 25 < 20 : d.advertising;
          return { ...d, age, advertising, bpm: advertising ? walk(d) : d.bpm };
        }),
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const summon = (profile: DemoProfile) => {
    counter.current += 1;
    const n = counter.current;
    setDevices((list) => [
      ...list,
      {
        id: `demo-${n}`,
        name: `Demo HRM ${n}`,
        profile,
        bpm: PROFILES[profile].start,
        advertising: true,
        connected: false,
        age: 0,
      },
    ]);
  };

  const dismiss = (id: string) => setDevices((list) => list.filter((d) => d.id !== id));
  const setAdvertising = (id: string, on: boolean) =>
    setDevices((list) => list.map((d) => (d.id === id ? { ...d, advertising: on, age: 0 } : d)));
  const dropConnection = (id: string) =>
    setDevices((list) => list.map((d) => (d.id === id ? { ...d, connected: false } : d)));

  return { devices, summon, dismiss, setAdvertising, dropConnection };
}

type Stub = ReturnType<typeof useStubDevices>;

const statusLine = (d: StubDevice) =>
  d.advertising
    ? `${PROFILES[d.profile].label} · ${d.bpm} BPM${d.connected ? ' · connected' : ''}`
    : 'not advertising — row greys out in the app';

// ------------------------------------------------------- variant A: sheet

/** Long-press the version footer → bottom sheet. Invisible until you know it. */
function VariantSheet({ stub, open, onClose }: { stub: Stub; open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={a.backdrop} onPress={onClose}>
        <Pressable style={a.sheet} onPress={() => {}}>
          <View style={a.handle} />
          <Text style={a.title}>Demo devices</Text>
          <View style={a.chipRow}>
            {(Object.keys(PROFILES) as DemoProfile[]).map((p) => (
              <Pressable key={p} style={a.chip} onPress={() => stub.summon(p)}>
                <Text style={a.chipText}>＋ {PROFILES[p].label}</Text>
              </Pressable>
            ))}
          </View>
          {stub.devices.map((d) => (
            <View key={d.id} style={[a.row, !d.advertising && a.rowDim]}>
              <View style={a.rowText}>
                <Text style={a.name}>{d.name}</Text>
                <Text style={a.meta}>{statusLine(d)}</Text>
              </View>
              {d.connected && (
                <Pressable style={a.dropBtn} onPress={() => stub.dropConnection(d.id)}>
                  <Text style={a.dropText}>drop</Text>
                </Pressable>
              )}
              <Switch
                value={d.advertising}
                onValueChange={(on) => stub.setAdvertising(d.id, on)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#FFFFFF"
              />
              <Pressable hitSlop={8} onPress={() => stub.dismiss(d.id)}>
                <Text style={a.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
          {stub.devices.length === 0 && <Text style={a.empty}>No demo devices summoned.</Text>}
          <Text style={a.hint}>Long-press the version footer to open this panel.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const a = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  chip: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  chipText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  rowDim: { opacity: 0.45 },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  dropBtn: {
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dropText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  remove: { color: colors.textDim, fontSize: 16, padding: spacing.xs },
  empty: { color: colors.textDim, textAlign: 'center', marginVertical: spacing.md },
  hint: { color: colors.textDim, fontSize: 11, textAlign: 'center', opacity: 0.7 },
});

// ----------------------------------------------------- variant B: console

/** Shake the phone → full-screen demo console. Zero UI footprint when closed. */
function VariantConsole({ stub, open, onClose }: { stub: Stub; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <View style={b.fill}>
      <View style={b.header}>
        <Text style={b.title}>Demo console</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={b.done}>Done</Text>
        </Pressable>
      </View>
      <Text style={b.section}>SUMMON A DEVICE</Text>
      {(Object.keys(PROFILES) as DemoProfile[]).map((p) => (
        <Pressable key={p} style={b.summonRow} onPress={() => stub.summon(p)}>
          <View style={b.rowText}>
            <Text style={b.name}>{PROFILES[p].label}</Text>
            <Text style={b.meta}>{PROFILES[p].blurb}</Text>
          </View>
          <Text style={b.plus}>＋</Text>
        </Pressable>
      ))}
      <Text style={b.section}>ACTIVE DEVICES</Text>
      {stub.devices.map((d) => (
        <View key={d.id} style={[b.card, !d.advertising && b.cardDim]}>
          <View style={b.cardTop}>
            <Text style={b.name}>{d.name}</Text>
            <Text style={b.bpm}>{d.advertising ? `${d.bpm} BPM` : '——'}</Text>
          </View>
          <Text style={b.meta}>{statusLine(d)}</Text>
          <View style={b.btnRow}>
            <Pressable style={b.btn} onPress={() => stub.setAdvertising(d.id, !d.advertising)}>
              <Text style={b.btnText}>{d.advertising ? 'Stop advertising' : 'Start advertising'}</Text>
            </Pressable>
            <Pressable
              style={[b.btn, !d.connected && b.btnDisabled]}
              disabled={!d.connected}
              onPress={() => stub.dropConnection(d.id)}
            >
              <Text style={b.btnText}>Drop connection</Text>
            </Pressable>
            <Pressable style={b.btn} onPress={() => stub.dismiss(d.id)}>
              <Text style={[b.btnText, b.btnDanger]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {stub.devices.length === 0 && <Text style={b.empty}>No demo devices summoned.</Text>}
      <View style={{ flex: 1 }} />
      <Text style={b.hint}>Shake the phone to open this console.</Text>
    </View>
  );
}

const b = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: spacing.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  done: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  section: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  summonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1 },
  plus: { color: colors.accent, fontSize: 22, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  cardDim: { opacity: 0.45 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  bpm: { color: colors.accent, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { color: colors.textDim, fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  btnDanger: { color: colors.accent },
  empty: { color: colors.textDim, textAlign: 'center', marginVertical: spacing.md },
  hint: { color: colors.textDim, fontSize: 11, textAlign: 'center', opacity: 0.7 },
});

// --------------------------------------------------------- variant C: dot

/** A faint dot in the corner, always present; taps open a compact panel. */
function VariantDot({ stub, open, onClose, onOpen }: { stub: Stub; open: boolean; onClose: () => void; onOpen: () => void }) {
  if (!open) {
    return (
      <Pressable style={c.dot} onPress={onOpen} hitSlop={12}>
        <View style={c.dotInner} />
      </Pressable>
    );
  }
  return (
    <View style={c.panel}>
      <View style={c.panelHeader}>
        <Text style={c.title}>Demo</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={c.collapse}>⌄</Text>
        </Pressable>
      </View>
      {stub.devices.map((d) => (
        <View key={d.id} style={[c.row, !d.advertising && c.rowDim]}>
          <Text style={c.name} numberOfLines={1}>
            {d.name.replace('Demo ', '')} · {d.advertising ? d.bpm : '—'}
          </Text>
          <Pressable hitSlop={6} onPress={() => stub.setAdvertising(d.id, !d.advertising)}>
            <Text style={[c.icon, d.advertising && c.iconOn]}>⏻</Text>
          </Pressable>
          <Pressable hitSlop={6} disabled={!d.connected} onPress={() => stub.dropConnection(d.id)}>
            <Text style={[c.icon, !d.connected && c.iconOff]}>⚡</Text>
          </Pressable>
          <Pressable hitSlop={6} onPress={() => stub.dismiss(d.id)}>
            <Text style={c.icon}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={c.spawnRow}>
        {(Object.keys(PROFILES) as DemoProfile[]).map((p) => (
          <Pressable key={p} style={c.spawnBtn} onPress={() => stub.summon(p)}>
            <Text style={c.spawnText}>＋{PROFILES[p].label[0]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  dot: { position: 'absolute', right: spacing.md, bottom: 76 },
  dotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    opacity: 0.35,
  },
  panel: {
    position: 'absolute',
    right: spacing.md,
    bottom: 76,
    width: 250,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  collapse: { color: colors.textDim, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowDim: { opacity: 0.45 },
  name: { color: colors.text, fontSize: 13, flex: 1, fontVariant: ['tabular-nums'] },
  icon: { color: colors.textDim, fontSize: 14, padding: 2 },
  iconOn: { color: colors.accent },
  iconOff: { opacity: 0.3 },
  spawnRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  spawnBtn: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  spawnText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
});

// ------------------------------------------------------------- switcher

const VARIANTS = [
  { key: 'A', label: 'Footer long-press → sheet' },
  { key: 'B', label: 'Shake → console' },
  { key: 'C', label: 'Corner dot → panel' },
] as const;

// screenshot driver: which variant and open-state the app boots into
const INITIAL_INDEX = 0;
const INITIAL_OPEN = false;

export function DemoSurfacePrototype() {
  const stub = useStubDevices();
  const [index, setIndex] = useState(INITIAL_INDEX);
  const [open, setOpen] = useState(INITIAL_OPEN);
  if (!__DEV__) return null;

  const variant = VARIANTS[index];
  const cycle = (dir: number) => {
    setIndex((i) => (i + dir + VARIANTS.length) % VARIANTS.length);
    setOpen(false);
  };

  return (
    <>
      {variant.key === 'A' && (
        <>
          {/* stands in for long-pressing the real version footer */}
          <Pressable style={s.footerStrip} onLongPress={() => setOpen(true)} />
          <VariantSheet stub={stub} open={open} onClose={() => setOpen(false)} />
        </>
      )}
      {variant.key === 'B' && <VariantConsole stub={stub} open={open} onClose={() => setOpen(false)} />}
      {variant.key === 'C' && (
        <VariantDot stub={stub} open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)} />
      )}
      <View style={s.bar}>
        <Pressable hitSlop={8} onPress={() => cycle(-1)}>
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setOpen((o) => !o)}>
          <Text style={s.label}>
            {variant.key} — {variant.label}
          </Text>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => cycle(1)}>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  footerStrip: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 44 },
  bar: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1F6FEB',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  arrow: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  label: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
