# Device Broadcast Instructions — Making Devices Advertise BLE Heart Rate

Research for issue #68 (map #67).

How to make each covered device broadcast heart rate over the standard BLE Heart
Rate Profile (GATT `0x180D`), verified against primary documentation (manufacturer
manuals and support pages). Every claim carries its source URL; anything that could
not be traced to a primary source is flagged in the per-section and final
"Could not verify" notes. This feeds user-facing help copy (English, text-only
numbered steps).

Verification date: 2026-07-19.

---

## 1. Chest straps

Common pattern, grounded per-brand below: **chest straps have no power button and are
invisible to BLE scans until worn** — moistened electrodes plus a snapped
connector/module close the circuit and wake the sensor. The second universal gotcha:
several straps accept only **one BLE connection at a time**, so a strap already
connected to another app/watch will not appear in a scan.

### 1.1 Polar H10

1. Moisten the electrode area of the strap ("Moisten the electrode area of the
   strap" — official step 1), fasten it snugly around the chest, then attach the
   connector. No power button; moisture/skin contact keeps it active ("Sweat and
   moisture may keep the electrodes wet and the heart rate sensor activated" —
   given as the reason to detach the connector after use).
   Source: [H10 manual — Wearing the heart rate sensor](https://support.polar.com/e_manuals/h10-heart-rate-sensor/polar-h10-user-manual-english/wear-the-heart-rate-sensor.htm);
   [Getting Started Guide PDF, 03/2024](https://support.polar.com/e_manuals/h10-heart-rate-sensor/polar-h10-getting-started-guide-english.pdf)
2. **2 simultaneous BLE connections — supported but OFF by default.** "H10 can be
   used with two Bluetooth devices at the same time … Turn **2 Bluetooth devices**
   setting on through the Polar Flow or Beat app." Requires firmware 2.1.9+
   (delivered via the Polar Flow app).
   Sources: Getting Started Guide PDF above;
   [FAQ: Can I pair H10 with several devices?](https://support.polar.com/us-en/can_i_pair_h10_with_several_devices)
3. **Default transports:** "By default, H10/H9 sends heart rate signal via
   Bluetooth, ANT+ and GymLink. To save the sensor battery lifetime, turn off the
   connections you don't need from the sensor settings in the Polar Flow or Beat
   app." Implication for troubleshooting: a previous owner/app may have disabled
   Bluetooth on the sensor.
   Source: Getting Started Guide PDF above.
4. Pairing gotchas: Polar pairs the sensor inside the Flow app, "not in your
   phone's Bluetooth settings"; when pairing, stay 10 m / 33 ft from other
   heart-rate-sensor users. Reset procedure (remove battery, press metal snaps
   10 s, wait 30 s, reinsert) exists for stuck sensors.
   Sources: [H10 manual — Pairing](https://support.polar.com/e_manuals/h10-heart-rate-sensor/polar-h10-user-manual-english/pairing.htm);
   [H9/H10 troubleshooting FAQ](https://support.polar.com/us-en/troubleshooting-polar-h9-h10-heart-rate-sensor)

### 1.2 Polar H9

1. Identical wearing/activation steps and wording to the H10 (moisten electrode
   area, fasten snugly, attach connector; moisture keeps it active).
   Source: [H9 manual — Wearing the heart rate sensor](https://support.polar.com/e_manuals/h9-heart-rate-sensor/polar-h9-user-manual-english/wear-the-heart-rate-sensor.htm);
   [shared Getting Started Guide PDF](https://support.polar.com/e_manuals/h9-heart-rate-sensor/polar-h9-getting-started-guide-english.pdf)
2. **1 BLE connection (by omission, not verbatim).** Polar's own comparison table
   lists "Dual Bluetooth: H10 Yes, H9 —", and the dual-BLE feature/toggle is
   documented only for the H10. Polar never states "H9 = 1 connection" in words —
   treat as strongly implied by primary sources.
   Source: [polar.com H9 product page comparison table](https://www.polar.com/en/sensors/h9-heart-rate-sensor)
3. Same default transports (Bluetooth + ANT+ + GymLink, each can be disabled in
   Flow/Beat) and same pairing/troubleshooting guidance as H10 (sources above).

### 1.3 Garmin HRM-Dual

1. **Active as soon as worn:** "After you put on the heart rate monitor, it is
   active and sending data." No button.
   Source: [HRM-Dual manual — Putting On the Heart Rate Monitor](https://www8.garmin.com/manuals/webhelp/hrm-dual/EN-US/GUID-D766457C-6F30-4004-9386-1681CB2C74C6.html)
2. **Wet the electrodes:** "Wet the electrodes and the contact patches on the back
   of the strap to create a strong connection between your chest and the
   transmitter." Re-wetting is also the documented fix for erratic data.
   Source: same manual page.
3. Pairing: put the strap on first, bring the receiving device within 3 m, and
   select the HRM-Dual from that device/app; stay 10 m from other wireless sensors
   while pairing. "After you pair the first time, your device automatically
   recognizes the heart rate monitor each time it is activated."
   Source: [HRM-Dual manual — Pairing with Your Bluetooth Device](https://www8.garmin.com/manuals/webhelp/hrm-dual/EN-US/GUID-26E43680-74CC-4CC7-946F-D5019AF632E4.html)
4. **BLE connection count: NOT documented by Garmin.** The oft-cited "unlimited
   ANT+ / 2 concurrent BLE" figure appears only in third-party reviews
   (DC Rainmaker, Cyclingnews) — flagged unverified.

### 1.4 Wahoo TICKR / TICKR X

1. **Wakes on heartbeat detection:** "Wake up your TICKR by wearing it on your
   chest (or touching both buckle terminals). The TICKR wakes when heartbeats are
   detected." Storage tip confirms the snap-circuit design: unbuckle at least one
   side of the strap to prevent battery drain.
   Source: [Wahoo TICKR Product Instructions](https://support.wahoofitness.com/hc/en-us/articles/115000320290-Wahoo-TICKR-Product-Instructions)
   (article body retrieved via the official help center's Zendesk API because the
   site blocks plain fetches — text is primary Wahoo copy)
2. **Moisten contacts:** "Moisten the contact points on the back of the strap with
   saliva or electrode gel to improve conductivity." (Wahoo suggests saliva or
   electrode gel, not just water.) Source: same article.
3. **BLE connection limits are generation-dependent:**
   - 2020+ "new" TICKR & TICKR X: "support up to 3 simultaneous Bluetooth devices
     at once" plus one ANT+ broadcast channel.
   - Original TICKR, TICKR X, TICKR FIT: "multiple connections of the same type
     are not currently possible over Bluetooth on these devices" — i.e. 1 BLE.
   - Wahoo's own caveat: "Wahoo always recommends only connecting to a single
     Bluetooth device at a time where possible."
   Sources: [Can I Pair the TICKR with Multiple Devices at Once?](https://support.wahoofitness.com/hc/en-us/articles/204281384-Can-I-Pair-the-TICKR-with-Multiple-Devices-at-Once);
   [Which Wahoo products offer Multiperipheral Bluetooth connections?](https://support.wahoofitness.com/hc/en-us/articles/360014828799-Which-Wahoo-products-offer-Multiperipheral-Bluetooth-connections)
4. **LED language (useful in help copy):** LEDs run ~30 s to save battery. Red
   flashes on each heartbeat. Blue: slow blink ≈1/s = awake, not paired; 4x flash =
   connection just made; quick blink ≈2/s = paired.
   Sources: TICKR Product Instructions above;
   [TICKR X Information and Setup](https://support.wahoofitness.com/hc/en-us/articles/4406637130002-TICKR-X-Heart-Rate-Monitor-Information-and-Setup)

### 1.5 Coospo (H808S, H6 chest straps; HW807 armband)

1. **H808S — skin contact wakes it; sleeps when not worn:** "please be wearing the
   heart rate monitor first before attempting to pair it with your phone. If you
   aren't wearing the monitor it will be in sleep mode and cannot be found by
   Bluetooth." Two beeps + green LED flash = worn correctly and heart rate
   detected; blue flash = pairing; a beep on removal = stopped working.
   Source: [official H808S manual PDF](https://www.coospo.com/wp-content/uploads/2021/12/COOSPO-H808S-User-Manual.pdf)
2. **H808S — moisten electrodes:** step 1 is "Moistening the electrode areas of
   the chest strap"; "Be sure that the moist electrode areas are firmly against
   your skin." Pairing gotcha, verbatim from the manual: "Don't searching device
   or try to pair on this page [phone Bluetooth settings], just turn on Bluetooth
   and go to the Fitness App!" Wireless: Bluetooth & ANT+; no BLE connection count
   documented. Source: same PDF.
3. **H6:** same skin-contact activation model per the official FAQ ("Wear it under
   the pec line, then pair it with your device, your heart rate will power the
   sensor so your Bluetooth can detect it").
   Source: [Coospo FAQ article 57817](https://www.coospo.com/a/faq/article/57817)
   — page is JS-rendered; wording captured from the official page's search
   snippet. Coospo's published H6 manual link currently serves the wrong document
   (a BC200 bike-computer manual), so no full H6 manual could be verified.
4. **HW807 armband — button-activated, NOT skin-activated:** "Turn-on: Press the
   start-up button, the LED light will flash blue quickly until the heart rate was
   found." Optical sensor — no electrodes, no moistening. Bluetooth 5.0 & ANT+.
   Source: [official HW807 manual PDF](https://www.coospo.com/wp-content/uploads/2022/05/COOSPO-HW807-User-Manual.pdf)
5. **Coospo BLE simultaneous-connection count: not documented anywhere official.**

### 1.6 Magene (H64; H603 partial)

1. **H64 — skin contact wakes it; sleeps 30 s after removal:** "Please wear the
   device correctly before attempting to connect to it. If the device is not worn,
   the device cannot be found by other equipment." "After the heart rate strap is
   removed, it will automatically enter a sleep state after 30 seconds."
   Source: [official H64 manual PDF](https://blog.magene.com/wp-content/uploads/2023/02/H64-Manual.pdf)
   (manuals index: [magene.com product manuals](https://www.magene.com/en/content/38-product-manuals))
2. **H64 — wet the electrodes:** "Wet the electrode area of the chest strap with
   water before wearing it." Source: same PDF.
3. **H64 — 1 BLE connection, explicitly documented:** "When using the Bluetooth
   protocol, you can only connect to one device or APP at a time. Please
   disconnect the old device or app when you need to connect to a new one." ANT+
   allows multiple simultaneous receivers. This is the exact "already connected
   elsewhere so it won't appear in a scan" gotcha in Magene's own words.
   Source: same PDF (Device Connection Instructions + FAQ item).
4. **H64 pairing gotchas:** search for the strap inside the fitness app —
   "Connecting to the monitor through the phone system's bluetooth settings is
   invalid." New units ship with a battery insulation film that must be removed.
   Source: same PDF.
5. **H603:** product page confirms concurrent ANT+ + Bluetooth use ("records data
   via both ANT+ device and Bluetooth App at the same time"), but no official
   H603 manual PDF was found; per-protocol connection limits unverified (likely
   match H64 wording, but that is inference).
   Sources: [H603 product page](https://www.magene.com/en/all-products/54-h603-heart-rate-monitor.html);
   [H603 support category](https://support.magene.com/hc/en-us/categories/4410637019929-H603-Heart-Rate-Monitor)

---

## 2. Garmin watches — "Broadcast Heart Rate"

Garmin watches broadcast wrist HR on demand. Menu path wording **varies by model
family** (verified verbatim from the owner's manuals; button glyphs in manuals were
translated to button names by the render — flagged in "Could not verify").

### 2.1 Forerunner (165 / 255 / 265 / 955 / 965)

All five current Forerunner manuals share the same topic (identical topic GUID
`GUID-D8D363C2-…` in each manual). Note the section is **Health & Wellness**, not
Sensors & Accessories:

1. Hold **UP**, and select **Health & Wellness > Wrist Heart Rate > Broadcast
   Heart Rate** (alternatively add the broadcast icon to the controls menu via
   hold LIGHT).
2. Press **START**. "The watch starts broadcasting your heart rate data."
3. Press **STOP** to stop broadcasting.

Sources: [FR 255](https://www8.garmin.com/manuals/webhelp/GUID-676967A0-1B23-4384-9BC9-76F3D643F1C8/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
[FR 265](https://www8.garmin.com/manuals/webhelp/GUID-F41EAFB3-6CC9-42DE-9C6C-9E358DBB0671/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
[FR 955](https://www8.garmin.com/manuals/webhelp/GUID-9D99A9D4-467A-4F1A-A0EA-023184FEA3DD/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
[FR 965](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
[FR 165](https://www8.garmin.com/manuals/webhelp/GUID-607F08F6-33FC-40BF-9727-84E54043D82D/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html)
(165/965 confirmed via shared-topic GUID + search snippet, not full-page fetch).

### 2.2 fenix 7 / epix (Gen 2) / fenix 8

1. fenix 7 & epix Gen 2: Hold **MENU**, select **Sensors & Accessories > Wrist
   Heart Rate > Broadcast Heart Rate**, press START; STOP to stop.
   Sources: [fenix 7](https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
   [epix Gen 2](https://www8.garmin.com/manuals/webhelp/GUID-E5C62F3F-DCE3-4197-8CA5-E419B2A55D12/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html)
2. fenix 8: path changed to **Watch Settings > Health & Wellness > Wrist Heart
   Rate > Broadcast Heart Rate**; start/stop with the upper-right button. Verbatim
   caveat: "Broadcasting heart rate data is not available for dive activities."
   Source: [fenix 8](https://www8.garmin.com/manuals/webhelp/GUID-EECCAC99-90D6-4AB1-9A3A-EC433D3365E2/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html)

### 2.3 Venu 3 / vivoactive 5 (touchscreen)

1. Hold **button B**, select **Settings > Watch Sensors > Wrist Heart Rate >
   Broadcast Heart Rate**; press **button A** to start broadcasting, press A again
   to stop. Settings-page description: "Broadcast Heart Rate: Allows you to begin
   broadcasting your heart rate data to a paired device."
   Sources: [Venu 3 broadcast page](https://www8.garmin.com/manuals/webhelp/GUID-9CC4A873-E034-4A06-B2E0-636DCFE760EE/EN-US/GUID-E224D0CC-A96C-4F5A-B0EB-83691D7BF923.html),
   [Venu 3 settings page](https://www8.garmin.com/manuals/webhelp/GUID-9CC4A873-E034-4A06-B2E0-636DCFE760EE/EN-US/GUID-39D4F07A-F166-4BBA-AC81-92DDED9F09B7.html),
   [vivoactive 5](https://www8.garmin.com/manuals/webhelp/GUID-5D183A14-BB43-4A9B-B441-5F824214CE40/EN-US/GUID-E224D0CC-A96C-4F5A-B0EB-83691D7BF923.html)
2. Older Venu generation (original Venu / Venu 2 / Venu Sq): hold B > **Settings >
   Wrist Heart Rate**, then choose **Broadcast In Activity** (during timed
   activities) or **Broadcast** (now). That manual pairs "with your Garmin ANT+
   compatible device" — no Bluetooth mention; the original Venu is not on Garmin's
   Bluetooth-broadcast list (see 2.5).
   Source: [Venu manual](https://www8.garmin.com/manuals/webhelp/venu/EN-US/GUID-8EC8B7FE-2AC2-46E9-94FC-06416FF1E2ED.html)

### 2.4 Broadcast during an activity

1. FR 955/965/165: dedicated "Broadcasting Heart Rate Data During an Activity"
   page — press START, choose activity, open activity settings, select
   **Broadcast Heart Rate**. Notable: "There is no indication that the watch is
   broadcasting your heart rate data during an activity"; broadcasting stops when
   the activity stops.
   Source: [FR 955 during-activity page](https://www8.garmin.com/manuals/webhelp/GUID-9D99A9D4-467A-4F1A-A0EA-023184FEA3DD/EN-US/GUID-57A88A77-3813-4E79-9DB1-FC95B06F01BA.html)
2. fenix 7 (and FR 265) instead expose it as an activity setting: "Broadcast Heart
   Rate — Automatically broadcasts heart rate data from your watch to paired
   devices when you start the activity" (Hold MENU > Activities & Apps > activity >
   settings). vivoactive 5 has the equivalent option.
   Sources: [fenix 7 activity settings](https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-E03FFCFD-15AD-401E-A15D-715629C6DBF0.html),
   [vivoactive 5 activity settings](https://www8.garmin.com/manuals/webhelp/GUID-5D183A14-BB43-4A9B-B441-5F824214CE40/EN-US/GUID-A8048FBA-ABB9-4786-B888-303A20574D68.html)

### 2.5 Bluetooth vs ANT+ only — the critical compatibility split

Primary source: Garmin FAQ
["Can Garmin Watches Broadcast Heart Rate Data?"](https://support.garmin.com/en-US/?faq=Zj1947s6pqAHzBCAhLhrC9)
(JS-rendered page; extracted via a text-render proxy twice with consistent
results — wording high-confidence but proxy-mediated).

1. Key sentence: "Any Garmin device or sensor that broadcasts over Bluetooth will
   also broadcast over ANT+® wireless protocol whenever you enable broadcasting."
   There is no BLE-only mode; Bluetooth-capable models broadcast both at once.
2. Also stated: "Broadcast heart rate data from our watches does not support
   secure connections" — the BLE broadcast is unencrypted/unbonded, which is good
   for a scanning app.
3. **Bluetooth-capable (visible to a BLE-only iOS app)** — Garmin's list includes,
   among ~80 models: Forerunner 55, 165, 245, 255, 265, 745, 945, 955, 965, 970;
   fenix 6/7/8 series and fenix E; epix Gen 2; Enduro 1–3; Instinct 2S/2 Solar/
   2X Solar/Crossover/3/E; Venu 2/2S/2 Plus/3/3S, Venu Sq 2 Music, Venu X1;
   vivoactive 5/6; vivosmart 5; MARQ; quatix 6–8; tactix Delta/7/8; and more.
4. **Notably ABSENT (therefore ANT+ only — a BLE-only iOS app cannot see them):**
   Forerunner 230/235/630/645/735XT/935; fenix 5 / 5 Plus series; vivoactive 3
   and 4; original Venu, original Venu Sq; original Instinct. Corroborated by
   their manuals mentioning only "Garmin ANT+ compatible device":
   [FR 230/235](https://www8.garmin.com/manuals/webhelp/forerunner230/EN-US/GUID-0C4E7DFB-E1C4-4EA8-885B-4DF88B3CD341.html),
   [fenix 5 Plus](https://www8.garmin.com/manuals/webhelp/fenix5plus/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html),
   [original Venu](https://www8.garmin.com/manuals/webhelp/venu/EN-US/GUID-8EC8B7FE-2AC2-46E9-94FC-06416FF1E2ED.html).
   Note: the ANT+-only conclusion is an inference from (a) absence from Garmin's
   Bluetooth list and (b) ANT+-only manual language — both primary, but no single
   Garmin sentence states the negative.
5. Every broadcast page carries: "Broadcasting heart rate data decreases battery
   life." Older modal-screen models (e.g. FR 235) exit broadcast by pressing any
   button and confirming "Exit Broadcast Mode"
   ([Garmin FAQ](https://support.garmin.com/en-US/?faq=U9k7zA5rvY7yC2v0H2rBL6)).

---

## 3. Polar watches — sharing wrist heart rate

Polar documents **two distinct features**, both reached from the pre-training mode
menu (NOT from General settings > Pair and sync on any current model):

- **HR sensor mode** ("Use watch as heart rate sensor" / older firmware: "Add a
  new device") — a private, *paired* connection to one receiving device.
- **Live heart rate broadcasting** ("Heart rate visible to all", off by default) —
  a public BLE broadcast; documented only on the newest models.

**Broadcast timing is the big caveat:** every manual states "HR sharing stops also
when you exit pre-training mode or stop the training recording." Polar watches only
share HR while in pre-training mode or during a training session — never
continuously from the watch face.

### 3.1 Steps (newest models: Vantage V3, Grit X2 Pro, Ignite 3, Vantage M3, Pacer, Pacer Pro)

1. Press and hold OK in time view (or press BACK for the main menu) and choose
   **Start training**.
2. Browse to your preferred sport; in pre-training mode open **Settings** (on
   Pacer/M2: open the quick menu with the LIGHT button).
3. Select **Share HR with other devices**.
4. Choose **Use watch as heart rate sensor** (pair with one device) or toggle
   **Heart rate visible to all** On (public broadcast; off by default).
5. Start the session; sharing stops when you exit pre-training mode or stop the
   recording. The setting is saved per sport profile.

Sources (per-model manual pages, "Live heart rate broadcasting" and
"HR sensor mode"):
[Vantage V3](https://support.polar.com/e_manuals/vantage-v3/polar-vantage-v3-user-manual-english/hr-sensor-mode.htm),
[Grit X2 Pro](https://support.polar.com/e_manuals/grit-x2-pro/polar-grit-x2-pro-user-manual-english/hr-sensor-mode.htm),
[Ignite 3](https://support.polar.com/e_manuals/ignite-3/polar-ignite-3-user-manual-english/hr-sensor-mode.htm),
[Vantage M3 live broadcasting](https://support.polar.com/e_manuals/vantage-m3/polar-vantage-m3-user-manual-english/live-heart-rate-broadcasting.htm),
[Pacer live broadcasting](https://support.polar.com/e_manuals/pacer/polar-pacer-user-manual-english/live-heart-rate-broadcasting.htm),
[Pacer Pro](https://support.polar.com/e_manuals/pacer-pro/polar-pacer-pro-user-manual-english/hr-sensor-mode.htm).
Release note: broadcasting "no longer enabled by default for any sport profile" —
[Grit X2 Pro 4.1 update](https://support.polar.com/en/updates/grit-x2-pro-41-update).

### 3.2 Older current models (paired HR sensor mode only)

1. **Vantage V2, Grit X, Grit X Pro:** pre-training quick menu (tap the icon or
   LIGHT button) > **Share HR with other device** (singular) > pair from the
   external device.
   Sources: [Vantage V2](https://support.polar.com/e_manuals/vantage-v2/polar-vantage-v2-user-manual-english/hr-sensor-mode.htm),
   [Grit X](https://support.polar.com/e_manuals/grit-x/polar-grit-x-user-manual-english/content/hr-sensor-mode.htm),
   [Grit X Pro](https://support.polar.com/e_manuals/grit-x-pro/polar-grit-x-pro-user-manual-english/content/hr-sensor-mode.htm)
2. **Vantage M2, Ignite 2, Unite:** pre-training quick menu > **Share HR with
   other devices** > **Add a new device** > pair; stop via **Stop sharing**.
   Sources: [Vantage M2](https://support.polar.com/e_manuals/vantage-m2/polar-vantage-m2-user-manual-english/hr-sensor-mode.htm),
   [Ignite 2](https://support.polar.com/e_manuals/ignite-2/polar-ignite-2-user-manual-english/hr-sensor-mode.htm),
   [Unite](https://support.polar.com/e_manuals/unite/polar-unite-user-manual-english/hr-sensor-mode.htm);
   support article [HR sensor mode](https://support.polar.com/en/hr-sensor-mode)
3. **Legacy models (e.g. M430, V800, M400):** sport-profile setting "**HR visible
   to other device**: Choose On or Off. If you choose On, other compatible devices
   using Bluetooth Smart wireless technology, e.g. gym equipment, can detect your
   heart rate."
   Source: [M430 manual — Sport Profiles Settings](https://support.polar.com/e_manuals/M430/Polar_M430_user_manual_English/Content/Sport-Profiles-Settings.htm)
   (V800/M400 similar per search snippets — not fully fetched).
4. **Vantage M / Vantage V / Ignite (1st gen): NO HR-sharing feature documented.**
   Their manuals contain no HR sensor mode page and the hr-sensor-mode URLs do not
   resolve. (Consistent with secondary reporting that the feature shipped with
   Ignite 2 / Vantage M2/V2/Grit X:
   [DC Rainmaker, Apr 2021](https://www.dcrainmaker.com/2021/04/polars-broadcasting-peloton.html) — secondary.)
   Sources (absence): [Vantage M general settings](https://support.polar.com/e_manuals/vantage-m/polar-vantage-m-user-manual-english/content/general-settings.htm),
   [Vantage V](https://support.polar.com/e_manuals/vantage-v/polar-vantage-v-user-manual-english/content/general-settings.htm)
5. Documented interference gotcha: some gym equipment uses "an older Bluetooth
   communication protocol" and can't receive; the watch may instead be sharing
   with the paired phone — tap "With iPhone" and stop sharing, or temporarily turn
   off the phone's Bluetooth.
   Source: [Troubleshooting HR sensor mode](https://support.polar.com/en/troubleshooting-ignite-2-hr-sensor-mode)

---

## 4. Apple Watch

### 4.1 No native BLE heart-rate broadcast

1. Apple's only documented gym-equipment HR sharing is **GymKit**: hold the Watch
   "within a few centimeters of the contactless reader on the gym equipment" —
   only for equipment labeled "Connects to Apple Watch". Nothing about
   broadcasting HR over Bluetooth to arbitrary devices.
   Source: [Use gym equipment with Apple Watch](https://support.apple.com/guide/watch/use-gym-equipment-apd15b0268fd/watchos)
2. Apple documents the Watch as a BLE *receiver* (pairing external HR sensors to
   the Watch via Settings > Bluetooth > Health Devices), not as a transmitter.
   Sources: [Bluetooth accessories with Apple Watch](https://support.apple.com/en-us/105059)
   (page fetch truncated — flagged);
   [watchOS cycling guide (Health Devices)](https://support.apple.com/en-me/guide/watch/apd4cbc876c7/watchos)
3. **Honest caveat:** Apple never states the negative explicitly. "No native BLE
   HR broadcast" is verified by absence across Apple's gym/Bluetooth/heart-rate
   support pages, plus the existence of a whole third-party app category that adds
   the capability.
4. Third-party broadcasting is possible because Core Bluetooth's peripheral role
   exists on watchOS: `CBPeripheralManager` is available on watchOS (introduced
   2.0) per Apple's own documentation metadata.
   Source: [CBPeripheralManager](https://developer.apple.com/documentation/corebluetooth/cbperipheralmanager)

### 4.2 Recommended broadcaster apps (verified on the App Store, July 2026)

1. **Echo: Watch Heart Rate Monitor** (Bred Ventures Inc.) — first choice.
   - [App Store](https://apps.apple.com/us/app/echo-watch-heart-rate-monitor/id1494679144):
     v6.0.8 released Jul 2026 (actively maintained), 4.4 stars / 3.6K ratings,
     free with IAP (Echo Pro $9.99/$19.99), iOS 16.4+ / watchOS 8.5+.
   - Official site states the standard-profile claim: "Echo turns your heart rate
     into a standard Bluetooth HR signal" — [echoheartrate.com](https://echoheartrate.com/)
   - Usage steps (official site): open the Echo app on the Apple Watch to begin
     broadcasting, then pair from the receiving device/app.
   - Third-party corroboration that it presents as a standard BLE HRM:
     [TrainingPeaks help article](https://help.trainingpeaks.com/hc/en-us/articles/42617060114445-TrainingPeaks-Virtual-Connect-Apple-Watch-Heart-Rate-using-Echo-HR-app)
2. **HeartCast: Heart Rate Monitor** (Logic Phase LLC) — second choice.
   - [App Store](https://apps.apple.com/us/app/heartcast-heart-rate-monitor/id1499771124):
     v3.7.0 released mid-July 2026 (actively maintained), free with IAP
     (Pro $4.99, Audible $7.99). Fewer ratings (24 on US storefront, 4.0 stars).
   - Description: "HeartCast broadcasts your heart rate from your Apple Watch or
     AirPods Pro 3 to Bluetooth-enabled fitness equipment" (Peloton, Zwift,
     TrainerRoad, "other devices that support Bluetooth Low Energy").
   - Usage steps (App Store description): open HeartCast on Watch and iPhone >
     press Start to begin a workout > connect from the fitness equipment/app.
   - Official site: [heartcast.app](https://www.heartcast.app/)
3. Rejected candidates (for the record): **BlueHeart** (Ubiquitly LLC,
   [App Store](https://apps.apple.com/us/app/blueheart-bluetooth-heart-rate/id1485503543))
   — great description but last updated 04/2021, five years stale;
   **Heart Rate Broadcast** (Kun Ni) — recent but only 10 ratings;
   **HRM Heart Rate Monitor** — broadcasts from the *iPhone* via HealthKit relay,
   not from the Watch; "HRM Sender" / "HeartBeats" — no apps found under those
   names; "ECHO HR / HR Broadcaster" are alternate names of the same Echo app.

---

## 5. Could not verify against primary sources

Chest straps:
- Garmin HRM-Dual concurrent BLE connection count ("2" is third-party reviews
  only; Garmin documents dual ANT+/BLE transmission but no number).
- Polar H9 "exactly 1 BLE connection" — implied by Polar's comparison table and
  the H10-only dual-BLE FAQ, never stated verbatim.
- Any Coospo BLE simultaneous-connection count; full Coospo H6 manual (official
  manual link serves the wrong PDF; H6 facts rest on the official FAQ page whose
  JS-rendered text was captured via search snippet).
- Magene H603 wearing/moistening/connection-limit specifics (no official manual
  found; product page + support category only).

Garmin watches:
- support.garmin.com FAQ pages are JS-only and were read via a text-render proxy
  (two consistent renders); re-check sub-model qualifiers in the Bluetooth list
  before publishing a compatibility table.
- FR 165 / FR 965 step text confirmed via shared-topic GUID + snippets, not full
  verbatim fetch. Button glyphs in several manuals (fenix 8, FR 955, Venu 3,
  vivoactive 5) were translated to button names by the renderer.
- Whether backing out of the broadcast screen (without STOP) keeps modern watches
  broadcasting — not documented anywhere primary.
- "FR 235 / fenix 5 / vivoactive 3 are ANT+ only" is an inference from two primary
  sources (list absence + ANT+-only manual language), not a single Garmin sentence.

Polar watches:
- No "Settings > General settings > Pair and sync > Share heart rate" path exists
  in any current manual (the ticket's guessed wording was wrong; real entry point
  is pre-training mode).
- "Heart rate visible to all" on Vantage V2/M2, Grit X/X Pro, Ignite 2, Unite —
  not documented; those models have paired HR sensor mode only.
- Max simultaneous connections / whether Flow app can stay connected while
  sharing — not stated by Polar; only the phone-interference workaround implies a
  conflict.

Apple Watch:
- Apple never explicitly denies BLE HRM broadcast (verified absent, not false).
- GymKit's reader is "contactless" per Apple; "NFC" is press terminology — use
  "contactless reader" in help copy if citing Apple.
- Neither Echo nor HeartCast names UUID 0x180D; "standard Bluetooth HR signal"
  wording + interoperability with Zwift/Peloton/TrainingPeaks is the evidence.
- Echo free-tier limit ("20-minute trial workouts") — search snippet only.

---

## 6. Implications for the app's help copy

1. **Chest straps:** one shared instruction block works — wet the electrode pads,
   clip the strap on snugly, and the strap starts advertising automatically; add a
   troubleshooting line "if it doesn't appear, make sure it isn't connected to
   another app or watch" (verbatim-grounded for Magene H64 and original TICKRs;
   H10 needs its 2-device toggle for multi-connection). Exception to call out:
   Coospo HW807 armband has a power button.
2. **Garmin:** give the three family-specific menu paths (Health & Wellness for
   Forerunner and fenix 8, Sensors & Accessories for fenix 7/epix, Watch Sensors
   for Venu 3/vivoactive 5) and warn that pre-2020-ish models (FR 235, fenix 5,
   vivoactive 3, original Venu…) broadcast ANT+ only and will never appear in the
   app.
3. **Polar:** instructions must route through Start training > pre-training
   Settings > Share HR with other devices, and must say sharing only works during
   a (pre-)training session. Only the newest models (Pacer/Pacer Pro, Ignite 3,
   Vantage V3/M3, Grit X2 Pro) have the public "Heart rate visible to all"
   broadcast; older ones pair to one device; 1st-gen Vantage/Ignite can't share
   at all.
4. **Apple Watch:** say there is no built-in broadcast and recommend Echo
   (primary) and HeartCast (alternate); user opens the watch app, starts the
   broadcast/workout, then connects from our app.
