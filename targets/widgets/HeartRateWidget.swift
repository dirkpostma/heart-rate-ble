import SwiftUI
import WidgetKit

private let appGroup = "group.dev.dirkpostma.heartrateble"
private let readingKey = "latestReading"

/// What the app's live-surface driver writes to the app group on every
/// reading (src/live/liveSurfaceDriver.ts). WidgetKit is budget-refreshed
/// and never live, so the widget shows "last reading + age" by design.
struct LatestReading: Codable {
  var bpm: Int
  var timestampMs: Double
  var deviceName: String
  /// "live" | "stale" | "ended" — drives the connection dot only; the
  /// age label is honest on its own via the relative date.
  var sessionState: String

  var timestamp: Date { Date(timeIntervalSince1970: timestampMs / 1000) }
}

struct ReadingEntry: TimelineEntry {
  let date: Date
  let reading: LatestReading?
}

/// One entry, no schedule: the age label ticks by itself as relative-date
/// text, and the app requests a reload only on session state transitions
/// (ticket #48) — never on a timer.
struct HeartRateTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> ReadingEntry {
    ReadingEntry(
      date: Date(),
      reading: LatestReading(
        bpm: 72, timestampMs: Date().timeIntervalSince1970 * 1000,
        deviceName: "Heart rate", sessionState: "live"))
  }

  func getSnapshot(in context: Context, completion: @escaping (ReadingEntry) -> Void) {
    completion(ReadingEntry(date: Date(), reading: load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ReadingEntry>) -> Void) {
    completion(Timeline(entries: [ReadingEntry(date: Date(), reading: load())], policy: .never))
  }

  private func load() -> LatestReading? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: readingKey),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(LatestReading.self, from: data)
  }
}

struct HeartRateWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HeartRateWidget", provider: HeartRateTimelineProvider()) { entry in
      WidgetView(reading: entry.reading)
        .widgetBackground(Theme.background)
    }
    .configurationDisplayName("Heart rate")
    .description("Last reading from your heart-rate sensor.")
    .supportedFamilies([.systemSmall])
  }
}

/// Digits layout (ticket #49): heart top-left, connection dot top-right,
/// the number filling the middle, unit + age in the footer. The age is
/// always visible — the widget never pretends to be live.
private struct WidgetView: View {
  let reading: LatestReading?

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Image(systemName: "heart.fill")
          .font(.system(size: 16))
          .foregroundColor(reading == nil ? Theme.textDim : Theme.accent)
        Spacer()
        Circle()
          .fill(dotColor)
          .frame(width: 8, height: 8)
      }
      Spacer()
      if let reading {
        Text("\(reading.bpm)")
          .font(.system(size: 56, weight: .bold, design: .rounded).monospacedDigit())
          .foregroundColor(reading.sessionState == "live" ? Theme.text : Theme.textDim)
          .minimumScaleFactor(0.5)
          .lineLimit(1)
        Spacer()
        HStack {
          Text("bpm")
          Spacer()
          Text(reading.timestamp, style: .relative)
            .multilineTextAlignment(.trailing)
        }
        .font(.caption2)
        .foregroundColor(Theme.textDim)
        .lineLimit(1)
      } else {
        Text("—")
          .font(.system(size: 56, weight: .bold, design: .rounded))
          .foregroundColor(Theme.textDim)
        Spacer()
        Text("no session yet")
          .font(.caption2)
          .foregroundColor(Theme.textDim)
      }
    }
    .padding(14)
  }

  private var dotColor: Color {
    switch reading?.sessionState {
    case "live": return Theme.success
    case "stale": return Theme.warning
    default: return Theme.textDim
    }
  }
}

extension View {
  /// containerBackground is mandatory on iOS 17+, absent on 16.2.
  @ViewBuilder fileprivate func widgetBackground(_ color: Color) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { color }
    } else {
      background(color)
    }
  }
}
