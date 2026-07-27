import Foundation

/// Deliberately Foundation-only, and deliberately its own file.
///
/// This is the widget's contract with the JS side, and the one piece of the
/// widget that can break silently: `HeartRateTimelineProvider.load()` decodes
/// with `try?`, so a schema drift against `src/live/liveSurfaceDriver.ts`
/// renders "no session yet" with no compile error and no crash. Keeping it
/// free of SwiftUI and WidgetKit is what lets the `native-tests` package
/// compile it for macOS and actually test it (#168).

/// What the app's live-surface driver writes to the app group on every
/// reading (`src/live/liveSurfaceDriver.ts`). WidgetKit is budget-refreshed
/// and never live, so the widget shows "last reading + age" by design.
struct LatestReading: Codable {
  var bpm: Int
  var timestampMs: Double
  var deviceName: String
  /// Raw session state as written by JS. Interpret via `state`, never by
  /// comparing strings at the call site.
  var sessionState: String

  var timestamp: Date { Date(timeIntervalSince1970: timestampMs / 1000) }

  /// The parsed session state, or nil for anything unrecognised — which the
  /// UI renders exactly like `ended` (a dim dot), never as live.
  var state: SessionState? { SessionState(rawValue: sessionState) }
}

/// The session states `liveSurfaceDriver.ts` emits. Stringly-typed on the
/// wire, so parse once here rather than comparing literals in a view where a
/// typo silently means "not live".
enum SessionState: String {
  case live
  case stale
  case ended
}
