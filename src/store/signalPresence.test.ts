import { HeartRateSample } from '../ble/HeartRateMonitor';
import { deriveSignalPresence, SIGNAL_STALE_MS } from './signalPresence';

const NOW = 1_000_000;
const sampleAt = (ageMs: number, bpm = 72): HeartRateSample => ({
  bpm,
  sensorContact: true,
  timestamp: NOW - ageMs,
});

// The live screen's truth table, extracted from LiveScreen.tsx by #150 so it
// could be tested without mounting a component. It had never been pinned.
describe('deriveSignalPresence', () => {
  describe('lost — the monitor reported the drop (#30)', () => {
    it("is lost whenever the connection state is 'disconnected'", () => {
      const p = deriveSignalPresence('disconnected', sampleAt(0), NOW);
      expect(p.lost).toBe(true);
      expect(p.connected).toBe(false);
    });

    // The lost screen keeps showing the final reading — "last reading", dimmed
    // — so bpm must survive the drop rather than blanking to "—".
    it('keeps the last reading visible so the lost state can show it', () => {
      expect(deriveSignalPresence('disconnected', sampleAt(0, 64), NOW).bpm).toBe(64);
    });

    it('is not stale or acquiring while lost — those are connected-only states', () => {
      const p = deriveSignalPresence('disconnected', sampleAt(60_000), NOW);
      expect(p.stale).toBe(false);
      expect(p.acquiring).toBe(false);
    });

    it.each(['connecting', 'reconnecting'] as const)('is not lost while %s', (state) => {
      expect(deriveSignalPresence(state, null, NOW).lost).toBe(false);
    });
  });

  describe('stale — connected but the sensor went silent', () => {
    it('is stale once a reading is older than the threshold', () => {
      const p = deriveSignalPresence('connected', sampleAt(SIGNAL_STALE_MS + 1), NOW);
      expect(p.stale).toBe(true);
      expect(p.connected).toBe(false);
    });

    // The comparison is `>`, not `>=`: exactly at the threshold is still fresh.
    it('is not stale exactly at the threshold', () => {
      expect(deriveSignalPresence('connected', sampleAt(SIGNAL_STALE_MS), NOW).stale).toBe(false);
    });

    // Suppressing the number is the whole point — a frozen, healthy-looking
    // BPM is worse than "—" when the watch has stopped broadcasting.
    it('suppresses the BPM while stale rather than freezing it', () => {
      expect(deriveSignalPresence('connected', sampleAt(SIGNAL_STALE_MS + 1), NOW).bpm).toBeNull();
    });

    it('is never stale without a sample — that is acquiring, not silence', () => {
      expect(deriveSignalPresence('connected', null, NOW).stale).toBe(false);
    });

    // Only 'connected' can go stale: while reconnecting, the state label
    // already tells the story.
    it.each(['connecting', 'reconnecting', 'disconnected'] as const)(
      'is not stale while %s, however old the sample',
      (state) => {
        expect(deriveSignalPresence(state, sampleAt(60_000), NOW).stale).toBe(false);
      },
    );
  });

  describe('acquiring — connected and fresh, but nothing to show yet', () => {
    it('is acquiring with no sample at all', () => {
      const p = deriveSignalPresence('connected', null, NOW);
      expect(p.acquiring).toBe(true);
      expect(p.bpm).toBeNull();
      expect(p.connected).toBe(true);
    });

    // A zero/negative reading is not a heart rate; treat it as "not yet".
    it.each([0, -1])('is acquiring when the reading is %s bpm', (bpm) => {
      const p = deriveSignalPresence('connected', sampleAt(0, bpm), NOW);
      expect(p.acquiring).toBe(true);
      expect(p.bpm).toBeNull();
    });

    it('stops acquiring once a real reading arrives', () => {
      const p = deriveSignalPresence('connected', sampleAt(0, 72), NOW);
      expect(p.acquiring).toBe(false);
      expect(p.bpm).toBe(72);
    });

    // Stale wins: a long-silent link shows "signal lost", not "acquiring".
    it('is not acquiring while stale', () => {
      expect(
        deriveSignalPresence('connected', sampleAt(SIGNAL_STALE_MS + 1, 0), NOW).acquiring,
      ).toBe(false);
    });
  });

  describe('connected — what greys the heart and the state dot', () => {
    it('is true only when connected and fresh', () => {
      expect(deriveSignalPresence('connected', sampleAt(0), NOW).connected).toBe(true);
    });

    it('is true while acquiring — the link is healthy, the data just has not arrived', () => {
      expect(deriveSignalPresence('connected', null, NOW).connected).toBe(true);
    });

    it.each(['connecting', 'reconnecting', 'disconnected'] as const)(
      'is false while %s',
      (state) => {
        expect(deriveSignalPresence(state, sampleAt(0), NOW).connected).toBe(false);
      },
    );
  });
});
