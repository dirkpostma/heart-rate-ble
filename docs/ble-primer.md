# BLE and heart rate: the fundamentals behind the two screens

This app has exactly two screens, and they sit on the two — completely
different — data paths that Bluetooth Low Energy offers. Understanding that
split explains most of the app's design.

## The two data paths

**Advertising (connectionless).** A BLE peripheral broadcasts small
advertisement packets several times per second to anyone listening. They are
a business card, not a data feed: *who I am and what I offer*. No connection,
no pairing, any number of listeners.

**GATT (connected).** The Generic Attribute Profile is how two devices
exchange actual data after connecting. Data is organized as **services**
(capabilities) containing **characteristics** (values) you can read, write,
or subscribe to. Only after connecting and subscribing does the sensor start
pushing measurements.

| | Scan screen | Live screen |
|---|---|---|
| Data path | Advertising | GATT notifications |
| Connection | None | Established + subscribed |
| Carries | Service UUIDs, device name (+ RSSI measured on reception) | Characteristic values — the actual BPM |
| Cadence | Several adverts/second | ~1 measurement/second |

The practical consequence: **the scan list can never show a heart rate.**
Advertisements from a standard heart-rate sensor carry identity and
proximity — the number itself is only released over a connection. (The spec
*allows* embedding live data in advertisements via the Service Data field,
but Garmin and most sensors don't use it.)

## The Heart Rate Profile in three ids

The Bluetooth SIG standardized heart rate long ago, which is why any app
works with any strap or watch:

- **`0x180D` — Heart Rate Service.** Advertised as a UUID; the scan filters
  on exactly this, so only heart-rate sensors ever appear in the list.
- **`0x2A37` — Heart Rate Measurement characteristic.** Subscribe to it and
  the sensor notifies you roughly once a second.
- **The flags byte.** Each measurement starts with a bitfield describing
  what follows: 8- vs 16-bit BPM, whether sensor-contact status is
  *supported* and *detected* (two separate bits, so "no info" is never
  confused with "no contact"), and whether RR-intervals are appended.

**RR-intervals** are the beat-to-beat gaps (ECG's R-peak to R-peak), the raw
material for heart-rate variability. Chest straps send them; a watch's
optical sensor can't resolve individual beats, so Garmin's broadcast mode
never does.

## What Garmin's "Broadcast Heart Rate" mode actually does

The watch becomes a minimal standard peripheral: it advertises `0x180D`,
accepts a couple of connections at most, and notifies two-byte measurements
(flags + BPM) at ~1 Hz. Two quirks drove real features in this app:

- **Silence instead of goodbye.** When broadcasting stops, the watch often
  keeps the link alive but just stops notifying — and stops advertising
  without any "I'm leaving" packet. Absence of data is the only signal.
- **Dropouts happen.** The link can drop mid-session, so the app runs a
  bounded auto-reconnect loop before giving up.

## How this shaped the app

- **Scan screen** = the advertising path. Rows show name and RSSI; a sensor
  unheard from for **3 s** greys out (stale) and revives on its next
  advertisement. The threshold balances fast detection against iOS scan
  duty-cycling, which produces occasional 1 s+ gaps between callbacks even
  while a sensor broadcasts steadily.
- **Live screen** = the GATT path. Connect → discover services → subscribe
  to `0x2A37` → parse flags + BPM per packet. If a *connected* sensor goes
  silent for **5 s**, the UI says "Connected — no signal" rather than
  pretending the frozen number is live.
- **One interface, two sources.** All of this hides behind a small
  `HeartRateMonitor` interface with two implementations — the real BLE one
  and a synthetic "Demo sensor" — so the entire UI, and the demo, run
  identically with or without hardware. The timing rules above live in a
  plain TypeScript store, unit-tested with fake timers.
