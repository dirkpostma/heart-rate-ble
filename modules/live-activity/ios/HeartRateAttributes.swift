import ActivityKit
import Foundation

/// Duplicated in targets/widgets/HeartRateAttributes.swift — ActivityKit
/// matches the activity between the app process and the widget extension
/// by this type's name and encoding, and a pod can't share source with an
/// Xcode target. Keep both definitions identical.
struct HeartRateAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var bpm: Int
    var timestamp: Date
  }

  var deviceName: String
}
