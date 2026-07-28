// swift-tools-version:5.9
import PackageDescription

// Rung 3 of the native verification ladder (#155/#168): unit tests for the
// widget's pure Swift logic.
//
// Why a Swift package rather than an Xcode unit-test target, which is what
// #168 originally proposed:
//
//   * @bacons/apple-targets has no test-bundle type — its registry emits only
//     application / extensionkit-extension / app-extension product types — so
//     an Xcode test target would have to be grafted on by a custom config
//     plugin doing pbxproj surgery, plus hand-written .xcscheme XML.
//   * `ios/` is CNG-generated and gitignored, so anything written there dies
//     at the next `expo prebuild --clean`. This package lives outside `ios/`,
//     so it survives prebuild by construction rather than by plugin.
//   * `swift test` needs no simulator and runs in about a second.
//
// The source is a SYMLINK to the real file the widget target compiles
// (targets/widgets/LatestReading.swift), so there is exactly one definition —
// this cannot drift from what ships.
//
// The limit of this approach: ActivityKit is iOS-only, so HeartRateAttributes
// .ContentState cannot be compiled for macOS and is not covered here. The
// cross-target invariant guarding it is rung `attributes` in
// scripts/verify-native.sh.
let package = Package(
  name: "WidgetLogic",
  platforms: [.macOS(.v13)],
  targets: [
    .target(name: "WidgetLogic"),
    .testTarget(name: "WidgetLogicTests", dependencies: ["WidgetLogic"]),
  ]
)
