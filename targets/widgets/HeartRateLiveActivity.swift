import ActivityKit
import SwiftUI
import WidgetKit

/// The chosen "Digits" direction (ticket #49): the BPM number is the
/// interface, the heart is a small live indicator. Stale (past the
/// staleDate the app advances on every update) dims the number, stops the
/// pulse and shows the reading's age — a health number must never look
/// live when it isn't (ticket #48).
struct HeartRateLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: HeartRateAttributes.self) { context in
      LockScreenBanner(context: context)
        .activityBackgroundTint(Theme.background)
        .activitySystemActionForegroundColor(Theme.accent)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.deviceName)
            .font(.caption)
            .foregroundColor(Theme.textDim)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          StatusLabel(isStale: context.isStale)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
              BpmDigits(bpm: context.state.bpm, isStale: context.isStale, size: 44)
              Text("bpm")
                .font(.footnote)
                .foregroundColor(Theme.textDim)
            }
            if context.isStale {
              AgeLine(timestamp: context.state.timestamp)
            }
          }
        }
      } compactLeading: {
        Heart(isStale: context.isStale, size: 15)
      } compactTrailing: {
        HStack(spacing: 3) {
          // Bare number, no unit — the heart is the unit.
          BpmDigits(bpm: context.state.bpm, isStale: context.isStale, size: 15)
          if context.isStale {
            Text(context.state.timestamp, style: .timer)
              .font(.system(size: 11).monospacedDigit())
              .foregroundColor(Theme.textDim)
              .frame(maxWidth: 40)
          }
        }
      } minimal: {
        Heart(isStale: context.isStale, size: 15)
      }
      .keylineTint(Theme.accent)
    }
  }
}

/// Single-row banner: minimum height, maximum glance — digits left,
/// heart over device name right.
private struct LockScreenBanner: View {
  let context: ActivityViewContext<HeartRateAttributes>

  var body: some View {
    HStack(alignment: .center) {
      VStack(alignment: .leading, spacing: 2) {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          BpmDigits(bpm: context.state.bpm, isStale: context.isStale, size: 40)
          Text("bpm")
            .font(.footnote)
            .foregroundColor(Theme.textDim)
        }
        if context.isStale {
          AgeLine(timestamp: context.state.timestamp)
        }
      }
      Spacer()
      VStack(alignment: .trailing, spacing: 4) {
        Heart(isStale: context.isStale, size: 22)
        Text(context.attributes.deviceName)
          .font(.caption2)
          .foregroundColor(Theme.textDim)
          .lineLimit(1)
      }
    }
    .padding(16)
  }
}

private struct Heart: View {
  let isStale: Bool
  var size: CGFloat

  var body: some View {
    // Widget processes can't run continuous custom animations; the
    // iOS 17+ pulse symbol effect is the closest to the app's BPM-driven
    // beat (PulsingHeart.tsx). Below 17, and while stale, it holds still.
    if #available(iOS 17.0, *), !isStale {
      Image(systemName: "heart.fill")
        .font(.system(size: size))
        .foregroundColor(Theme.accent)
        .symbolEffect(.pulse, options: .repeating)
    } else {
      Image(systemName: "heart.fill")
        .font(.system(size: size))
        .foregroundColor(isStale ? Theme.textDim : Theme.accent)
    }
  }
}

struct BpmDigits: View {
  let bpm: Int
  let isStale: Bool
  var size: CGFloat

  var body: some View {
    Text("\(bpm)")
      .font(.system(size: size, weight: .bold, design: .rounded).monospacedDigit())
      .foregroundColor(isStale ? Theme.textDim : Theme.text)
  }
}

private struct StatusLabel: View {
  let isStale: Bool

  var body: some View {
    if isStale {
      Text("STALE · no signal")
        .font(.caption2.weight(.semibold))
        .foregroundColor(Theme.warning)
    } else {
      Text("LIVE")
        .font(.caption2.weight(.semibold))
        .foregroundColor(Theme.accent)
    }
  }
}

private struct AgeLine: View {
  let timestamp: Date

  var body: some View {
    HStack(spacing: 3) {
      Text("last reading")
      Text(timestamp, style: .relative)
      Text("ago")
    }
    .font(.caption2)
    .foregroundColor(Theme.textDim)
  }
}
