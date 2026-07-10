# BLE Heart Rate Profile & Garmin Broadcast Behavior

Research for issue #2. Everything an implementer needs to scan, connect, subscribe, and
parse heart rate from a Garmin watch in "Broadcast Heart Rate" mode, iOS-first, using
`react-native-ble-plx`.

## 1. Heart Rate Service (0x180D) — advertising and discovery

- Standard GATT service, 16-bit UUID `0x180D`; 128-bit form
  `0000180d-0000-1000-8000-00805f9b34fb`.
- The Heart Rate Profile requires sensors to advertise the service UUID in the
  advertising data (Complete/Incomplete List of 16-bit Service UUIDs), so **scan
  filtering by service UUID is the correct discovery mechanism** — no name matching
  needed.
- In `react-native-ble-plx`:

  ```ts
  manager.startDeviceScan(["180d"], null, (error, device) => { ... });
  ```

  Short 16-bit form is accepted; ble-plx normalizes UUIDs to the 128-bit form.
- Service contents (mandatory/optional):
  | Characteristic | UUID | Props | Notes |
  |---|---|---|---|
  | Heart Rate Measurement | `0x2A37` | Notify only (not readable) | mandatory |
  | Body Sensor Location | `0x2A38` | Read | optional |
  | Heart Rate Control Point | `0x2A39` | Write | optional; only for resetting Energy Expended |

Sources: [Heart Rate Service 1.0 (Bluetooth SIG)](https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/),
[Heart Rate Profile 1.0](https://www.bluetooth.com/specifications/specs/heart-rate-profile-1-0/),
[Assigned Numbers](https://www.bluetooth.com/specifications/assigned-numbers/).

## 2. Heart Rate Measurement (0x2A37) — byte-level parsing

Notification payload: `[Flags (1 byte)] [HR value (1–2 bytes)] [Energy Expended (0 or 2 bytes)] [RR-Intervals (0–2n bytes)]`.
All multi-byte fields are **little-endian**. Field order is fixed as listed.

Flags byte (byte 0):

| Bit(s) | Meaning |
|---|---|
| 0 | HR value format: `0` = UINT8 (1 byte), `1` = UINT16 LE (2 bytes) |
| 1–2 | Sensor Contact Status: `0b00`/`0b01` = feature not supported; `0b10` = supported, contact **not** detected; `0b11` = supported, contact detected |
| 3 | Energy Expended present (UINT16 LE, unit: kilojoules) |
| 4 | One or more RR-Interval values present (each UINT16 LE, unit: **1/1024 second**) |
| 5–7 | Reserved |

Notes:
- Most sensors at rest send 2-byte packets: `flags=0x00, hr=UINT8`. A sensor may switch
  to 16-bit format any time (e.g. HR > 255 is theoretical, but parse both — flags can
  vary per notification).
- RR-intervals: as many as fit in the remaining bytes (up to 9 with 8-bit HR and no EE),
  **oldest first**. Convert to ms: `rr * 1000 / 1024`. These are the beat-to-beat
  intervals used for HRV.
- Energy Expended, when supported, is only required to be included in ~1 of every 10
  measurements; don't rely on its presence.
- Worked example — payload `16 3C 66 02 68 02` (hex):
  - flags `0x16` = `0b00010110` → 8-bit HR (bit 0 = 0), sensor contact supported and
    detected (bits 1–2 = 0b11), no Energy Expended (bit 3 = 0), RR-intervals present
    (bit 4 = 1).
  - HR = `0x3C` = 60 bpm.
  - RR₁ = `0x0266` = 614 → 599.6 ms; RR₂ = `0x0268` = 616 → 601.6 ms.
- Worked example — typical Garmin broadcast payload `00 48`: flags `0x00` (8-bit HR, no
  contact info, no EE, no RR), HR = 72 bpm.

### TypeScript parser

ble-plx delivers `characteristic.value` as base64; decode to bytes first
(e.g. `Buffer.from(value, "base64")` with the `buffer` package, or a small atob shim).

```ts
export interface HeartRateMeasurement {
  bpm: number;
  sensorContact: "unsupported" | "noContact" | "contact";
  energyExpendedKJ?: number;
  rrIntervalsMs: number[];
}

export function parseHeartRateMeasurement(bytes: Uint8Array): HeartRateMeasurement {
  const flags = bytes[0];
  const is16Bit = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  let offset = 1;
  const bpm = is16Bit ? bytes[offset] | (bytes[offset + 1] << 8) : bytes[offset];
  offset += is16Bit ? 2 : 1;

  let energyExpendedKJ: number | undefined;
  if (hasEnergy) {
    energyExpendedKJ = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (hasRR) {
    for (; offset + 1 < bytes.length; offset += 2) {
      const rr = bytes[offset] | (bytes[offset + 1] << 8);
      rrIntervalsMs.push((rr * 1000) / 1024);
    }
  }

  return {
    bpm,
    sensorContact:
      contactBits < 2 ? "unsupported" : contactBits === 2 ? "noContact" : "contact",
    energyExpendedKJ,
    rrIntervalsMs,
  };
}
```

Subscribe with `device.monitorCharacteristicForService("180d", "2a37", listener)`.
Notifications arrive ~1 per second (typical HR sensor cadence, including Garmin).

Sources: [GATT Specification Supplement](https://www.bluetooth.com/specifications/gss/)
(Heart Rate Measurement section), [Heart Rate Service 1.0](https://www.bluetooth.com/specifications/specs/heart-rate-service-1-0/),
[ble-plx HR parsing discussion (issue #434)](https://github.com/dotintent/react-native-ble-plx/issues/434).

## 3. Nice-to-have reads

- **Body Sensor Location `0x2A38`** (optional, Read): single UINT8 —
  0 Other, 1 Chest, 2 Wrist, 3 Finger, 4 Hand, 5 Ear Lobe, 6 Foot. A Garmin watch,
  if it exposes it, reports Wrist (2).
- **Battery Service `0x180F`** / **Battery Level `0x2A19`** (Read, often Notify):
  single UINT8, 0–100 %. Separate service — read opportunistically; not all broadcast
  sources expose it.

## 4. Garmin "Broadcast Heart Rate" behavior

**Enabling (general pattern across models):**
- Hold **MENU/UP** → **Sensors & Accessories** → **Wrist Heart Rate** → **Broadcast
  Heart Rate** → press **START**. Or open the controls menu (hold LIGHT) and tap the
  broadcast-HR icon. There is also a separate **Broadcast During Activity** setting that
  auto-broadcasts whenever an activity is running.
  ([fenix 7 manual](https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
  [Garmin support FAQ](https://support.garmin.com/en-US/?faq=Zj1947s6pqAHzBCAhLhrC9))
- Modern watches (fenix 6 post-mid-2020 firmware, fenix 7/8, FR 245/255/265/745/945/955/965,
  Venu, Instinct 2/3, …) broadcast **dual ANT+ and BLE** from this mode. Very old models
  are ANT+-only; FR245/945/fenix 6 originally exposed BLE only via the "Virtual Run"
  activity profile.
  ([DC Rainmaker how-to](https://www.dcrainmaker.com/2020/04/garmin-wearable-broadcasting.html),
  [DC Rainmaker dual-broadcast tidbit](https://www.dcrainmaker.com/2020/06/tidbit-bluetooth-broadcasting.html))

**How it appears in a scan:**
- Advertises Heart Rate Service `0x180D`; a `startDeviceScan(["180d"])` filter finds it.
- Device name = the watch's own name, e.g. `fenix 7`, `Forerunner 255`, `Venu 3`
  (check both `device.name` and `device.localName` in ble-plx; on iOS the advertised
  local name can be absent and the GAP name may be cached).

**Connection model:**
- **Broadcast-only in the pairing sense: no bonding/encryption needed.** A central just
  connects, discovers `0x180D`, and enables notifications on `0x2A37`. iOS shows no
  pairing dialog.
- Concurrent centrals are limited: DC Rainmaker measured **2 simultaneous BLE
  connections** on fenix 6 (a third connect kicked one off); ANT+ side is unlimited.
  Design for exclusive access — assume another app/Apple TV/head unit may steal the slot.

**Known quirks (forum-verified):**
- **No RR-intervals over broadcast.** Garmin keeps beat-to-beat data internal; flags
  bit 4 stays 0, so HRV from a broadcasting Garmin watch is not possible.
  ([Garmin forums: Broadcast Heart Rate R-R intervals?](https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-745/243411/broadcast-heart-rate-r-r-intervals))
- **Broadcast stops when the mode/activity ends.** Leaving broadcast mode (STOP) or
  finishing an activity (with Broadcast During Activity) kills the link; apps see a
  disconnect. Virtual Run's idle "ready to pair" state times out after ~30–40 min.
  ([DC Rainmaker](https://www.dcrainmaker.com/2020/04/garmin-wearable-broadcasting.html))
- **Intermittent broadcast dropouts** are widely reported (watch UI still says
  broadcasting, receiver gets nothing; fixed by toggling broadcast or rebooting the
  watch). Handle disconnects gracefully and auto-rescan/reconnect.
  ([fenix 6 thread](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/fenix-6-series/337227/broadcast-heart-rate-intermittently-stops-working),
  [fenix 7 toggle thread](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/fenix-7-series/354453/why-do-you-have-to-toggle-broadcast-heartrate-off-and-on-every-time-you-start-indoor-ride))
- Occasional **0 BPM readings** right after enabling (optical sensor not locked yet);
  treat `bpm === 0` as "acquiring", not an error.
  ([Instinct 3 thread](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/instinct-3/403806/instinct-3-amoled-broadcast-heart-rate-over-bluetooth-shows-0-bpm))
- Update cadence is ~1 Hz notifications; payload is usually the minimal 2-byte
  `flags + uint8 bpm` form.

## 5. iOS / CoreBluetooth notes

- **Foreground:** scanning with `nil` services works, but filtering by `0x180D` is
  cheaper and is what we should do anyway.
- **Background:** service-UUID filtering becomes **mandatory** — a nil-filter scan
  returns nothing in background; duplicate advertisements are coalesced (one callback
  per peripheral), and `CBAdvertisementDataLocalNameKey` is typically stripped from
  backgrounded advertisers. Requires the `bluetooth-central` background mode in
  Info.plist if we ever want background scanning.
  ([Apple: scanForPeripherals(withServices:options:)](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager/scanforperipherals(withservices:options:)),
  [Punch Through iOS BLE scanning guide](https://punchthrough.com/ios-ble-scanning-guide/))
- iOS never exposes MAC addresses; peripherals get an iOS-generated UUID that is stable
  per phone but not across devices — persist last-connected device by that UUID, plus
  name as a fallback hint.
- iOS caches GAP device names; after a watch rename the old name can stick around.
  Prefer `localName` from the advertisement when present.
- `NSBluetoothAlwaysUsageDescription` is required in Info.plist (Expo:
  `expo-build-properties` / config plugin for `react-native-ble-plx` handles this).
- ble-plx users commonly hit: base64 characteristic values (decode before parsing),
  and monitor callbacks continuing after disconnect (remove subscription on
  `onDeviceDisconnected`).

## Implications for our implementation

1. Scan with service filter `["180d"]` only; show `name ?? localName ?? id` in the UI.
2. Connect without any pairing UX; discover services/characteristics, then
   `monitorCharacteristicForService("180d", "2a37", ...)`.
3. Use the full flags-aware parser above even though Garmin usually sends 2-byte
   packets — it costs nothing and works with chest straps (Polar/Garmin HRM) too.
4. Treat 0 BPM as "acquiring signal"; surface sensor-contact state only when the
   feature bits say it's supported.
5. Expect disconnects: watch leaves broadcast mode, activity ends, or another central
   takes a slot. Implement auto-reconnect (rescan for same device UUID) with clear UI
   state (scanning / connecting / streaming / lost).
6. Don't build HRV features on Garmin broadcast — no RR intervals. RR support in the
   parser still pays off for chest straps.
7. Battery level (0x180F/0x2A19) and Body Sensor Location (0x2A38) are optional reads;
   query them best-effort after connect, tolerate absence.
