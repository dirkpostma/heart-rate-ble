import SwiftUI
import WidgetKit

/// One extension hosts both surfaces: the home-screen widget and the
/// Live Activity (Dynamic Island + Lock Screen) — decided in ticket #46.
@main
struct HeartRateWidgetBundle: WidgetBundle {
  var body: some Widget {
    HeartRateWidget()
    HeartRateLiveActivity()
  }
}
