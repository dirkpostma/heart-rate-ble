import SwiftUI

/// The app's palette (src/theme.ts), so the system surfaces read as the
/// same product as the app itself.
enum Theme {
  static let background = Color(hex: 0x0D1117)
  static let surface = Color(hex: 0x161B22)
  static let text = Color(hex: 0xE6EDF3)
  static let textDim = Color(hex: 0x8B949E)
  static let accent = Color(hex: 0xFF2D55)
  static let success = Color(hex: 0x3FB950)
  static let warning = Color(hex: 0xD29922)
}

extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255
    )
  }
}
