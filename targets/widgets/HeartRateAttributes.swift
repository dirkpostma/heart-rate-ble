import ActivityKit
import Foundation

/// The Live Activity's identity and per-update state.
///
/// Duplicated in modules/live-activity/ios/HeartRateAttributes.swift — the
/// app process and this extension match activities by this type's name and
/// encoding, and a local Expo module (a pod) can't share source with an
/// Xcode target. Keep both definitions identical.
struct HeartRateAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// Last heart-rate reading, integer BPM.
    var bpm: Int
    /// When that reading arrived; drives the relative-age labels.
    var timestamp: Date
  }

  /// Name of the connected sensor, fixed for the activity's lifetime.
  var deviceName: String
}
