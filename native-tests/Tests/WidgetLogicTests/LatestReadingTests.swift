import XCTest

@testable import WidgetLogic

/// `HeartRateTimelineProvider.load()` decodes with `try?`, so any drift
/// between this struct and what `src/live/liveSurfaceDriver.ts` writes to the
/// app group renders "no session yet" — silently, with no compile error and no
/// crash. These tests are the only thing standing between that contract and a
/// widget that quietly stops working.
final class LatestReadingTests: XCTestCase {
  private func decode(_ json: String) throws -> LatestReading {
    try JSONDecoder().decode(LatestReading.self, from: Data(json.utf8))
  }

  // The exact shape liveSurfaceDriver.ts writes: { bpm, timestampMs,
  // deviceName, sessionState }. If any key here is renamed on either side,
  // this fails.
  func testDecodesTheWidgetReadingTheAppActuallyWrites() throws {
    let reading = try decode(
      #"{"bpm":72,"timestampMs":1750000000000,"deviceName":"Forerunner","sessionState":"live"}"#)

    XCTAssertEqual(reading.bpm, 72)
    XCTAssertEqual(reading.timestampMs, 1_750_000_000_000)
    XCTAssertEqual(reading.deviceName, "Forerunner")
    XCTAssertEqual(reading.sessionState, "live")
  }

  func testRejectsAPayloadMissingAKey() {
    // deviceName absent — decoding must fail rather than default it.
    XCTAssertThrowsError(
      try decode(#"{"bpm":72,"timestampMs":1750000000000,"sessionState":"live"}"#))
  }

  func testRejectsAWronglyTypedField() {
    XCTAssertThrowsError(
      try decode(
        #"{"bpm":"72","timestampMs":1750000000000,"deviceName":"X","sessionState":"live"}"#))
  }

  // JS timestamps are milliseconds; Date wants seconds. Getting this wrong by
  // 1000x puts every reading in 1970 or the far future, and the widget's
  // relative-age label is the only place it would show.
  func testConvertsJavaScriptMillisecondsToADate() throws {
    let reading = try decode(
      #"{"bpm":72,"timestampMs":1750000000000,"deviceName":"X","sessionState":"live"}"#)

    XCTAssertEqual(reading.timestamp.timeIntervalSince1970, 1_750_000_000, accuracy: 0.001)
  }

  func testKeepsSubSecondPrecision() throws {
    let reading = try decode(
      #"{"bpm":72,"timestampMs":1750000000500,"deviceName":"X","sessionState":"live"}"#)

    XCTAssertEqual(reading.timestamp.timeIntervalSince1970, 1_750_000_000.5, accuracy: 0.001)
  }

  func testRoundTripsThroughEncodeAndDecode() throws {
    let original = LatestReading(
      bpm: 143, timestampMs: 1_750_000_000_000, deviceName: "Forerunner 970",
      sessionState: "stale")

    let decoded = try JSONDecoder().decode(
      LatestReading.self, from: JSONEncoder().encode(original))

    XCTAssertEqual(decoded.bpm, original.bpm)
    XCTAssertEqual(decoded.timestampMs, original.timestampMs)
    XCTAssertEqual(decoded.deviceName, original.deviceName)
    XCTAssertEqual(decoded.sessionState, original.sessionState)
  }
}

/// The session state is stringly-typed on the wire. The widget's dot colour
/// switches on it, and the failure mode of a typo is "silently never live".
final class SessionStateTests: XCTestCase {
  func testParsesEveryStateTheDriverEmits() {
    // These three strings are written by liveSurfaceDriver.ts's
    // WidgetSessionState union — they must stay in lockstep.
    XCTAssertEqual(SessionState(rawValue: "live"), .live)
    XCTAssertEqual(SessionState(rawValue: "stale"), .stale)
    XCTAssertEqual(SessionState(rawValue: "ended"), .ended)
  }

  func testTreatsAnUnknownStateAsUnparsed() {
    // The view renders nil exactly like .ended — a dim dot, never live.
    XCTAssertNil(SessionState(rawValue: "paused"))
    XCTAssertNil(SessionState(rawValue: ""))
    XCTAssertNil(SessionState(rawValue: "Live"))  // case-sensitive on purpose
  }

  func testReadingExposesItsParsedState() throws {
    let live = try JSONDecoder().decode(
      LatestReading.self,
      from: Data(
        #"{"bpm":72,"timestampMs":1,"deviceName":"X","sessionState":"live"}"#.utf8))
    let bogus = try JSONDecoder().decode(
      LatestReading.self,
      from: Data(
        #"{"bpm":72,"timestampMs":1,"deviceName":"X","sessionState":"nonsense"}"#.utf8))

    XCTAssertEqual(live.state, .live)
    XCTAssertNil(bogus.state)
  }
}
