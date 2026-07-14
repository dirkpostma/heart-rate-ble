import ActivityKit
import ExpoModulesCore

/// start/update/end for the heart-rate Live Activity. Operates on
/// `Activity<HeartRateAttributes>.activities` rather than a held reference,
/// so it stays correct across JS reloads and app relaunches that leave an
/// activity behind.
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Function("isSupported") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (deviceName: String, bpm: Int, timestampMs: Double, staleDateMs: Double) in
      // A leftover activity from a previous session would strand a second
      // one in the island; end anything still up before starting fresh.
      for activity in Activity<HeartRateAttributes>.activities {
        await activity.end(activity.content, dismissalPolicy: .immediate)
      }
      let content = ActivityContent(
        state: Self.state(bpm: bpm, timestampMs: timestampMs),
        staleDate: Self.date(ms: staleDateMs)
      )
      _ = try Activity.request(
        attributes: HeartRateAttributes(deviceName: deviceName),
        content: content
      )
    }

    AsyncFunction("update") { (bpm: Int, timestampMs: Double, staleDateMs: Double) in
      let content = ActivityContent(
        state: Self.state(bpm: bpm, timestampMs: timestampMs),
        staleDate: Self.date(ms: staleDateMs)
      )
      for activity in Activity<HeartRateAttributes>.activities {
        await activity.update(content)
      }
    }

    AsyncFunction("end") {
      for activity in Activity<HeartRateAttributes>.activities {
        await activity.end(activity.content, dismissalPolicy: .immediate)
      }
    }
  }

  private static func state(bpm: Int, timestampMs: Double) -> HeartRateAttributes.ContentState {
    HeartRateAttributes.ContentState(bpm: bpm, timestamp: date(ms: timestampMs))
  }

  private static func date(ms: Double) -> Date {
    Date(timeIntervalSince1970: ms / 1000)
  }
}
