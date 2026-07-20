// Bundled help content for "How to connect my device". Text-only, English,
// short numbered steps. Distilled from the verified research in
// docs/research/device-broadcast-instructions.md (issue #68) — steps are kept
// generic per device *type* with brands name-checked, not freehanded.
//
// Content ships in the app bundle; copy fixes ride an EAS Update, no store
// release. Keep steps short and imperative to match the app's tone.

export type HelpSection = {
  /** Stable key for list rendering and collapse state. */
  id: string;
  title: string;
  /** One-line orientation shown under the title, before the steps. */
  intro?: string;
  steps: string[];
  /** Optional trailing note — gotchas that aren't a numbered step. */
  note?: string;
};

// The app only sees devices that broadcast over standard Bluetooth LE. The two
// facts users trip on most, surfaced up front: straps wake only when worn, and
// most sensors allow just one Bluetooth connection at a time.
export const connectHelpSections: HelpSection[] = [
  {
    id: 'chest-straps',
    title: 'Chest straps',
    intro:
      'Polar H9/H10, Garmin HRM-Dual, Wahoo TICKR, Coospo, Magene, and most others.',
    steps: [
      'Moisten the electrode strip on the back of the strap with water (or a little saliva).',
      'Fasten it snugly around your chest and snap on the sensor module. There is no power button — skin contact wakes it, so it stays invisible until you put it on.',
      'Disconnect it from any other app or watch first. Most straps allow only one Bluetooth connection at a time, so a strap already paired elsewhere will not appear here.',
      'Keep the strap close to your phone and pull down to refresh this list.',
    ],
    note:
      'Optical armbands like the Coospo HW807 have a button instead — press it until the light flashes, then scan.',
  },
  {
    id: 'garmin-watch',
    title: 'Garmin watches',
    intro: 'Turn on Broadcast Heart Rate — the menu path varies by model.',
    steps: [
      'Forerunner 165/255/265/955/965: hold UP, then Health & Wellness › Wrist Heart Rate › Broadcast Heart Rate, and press START.',
      'fenix 7 / epix (Gen 2): hold MENU, then Sensors & Accessories › Wrist Heart Rate › Broadcast Heart Rate, and press START.',
      'Venu 3 / vivoactive 5: hold the middle button, then Settings › Watch Sensors › Wrist Heart Rate › Broadcast Heart Rate.',
      'While broadcasting, keep the watch close and pull down to refresh this list.',
    ],
    note:
      'Older Garmins (Forerunner 235, fenix 5, original Venu, and similar) broadcast only over ANT+, which iPhones cannot receive — they will not show up here.',
  },
  {
    id: 'polar-watch',
    title: 'Polar watches',
    intro: 'Polar shares heart rate only while a workout is starting or running.',
    steps: [
      'Start a training session: hold OK, choose Start training, and pick any sport.',
      'In the pre-training screen open Settings (on some models, the quick menu via the LIGHT button).',
      'Choose Share HR with other devices, then turn on Heart rate visible to all (or Use watch as heart rate sensor).',
      'Start the session and pull down to refresh this list. Sharing stops when you exit the workout.',
    ],
    note:
      'Heart-rate sharing arrived with the Vantage V2, Vantage M2, Grit X, and Ignite 2. First-generation Vantage and Ignite watches cannot share.',
  },
  {
    id: 'apple-watch',
    title: 'Apple Watch & other smartwatches',
    intro:
      'Apple Watch cannot broadcast heart rate on its own — it needs a small broadcaster app.',
    steps: [
      'Install a broadcaster app on your Apple Watch. Echo: Watch Heart Rate Monitor works well; HeartCast is another option.',
      'Open the app on the Watch and start broadcasting (it turns your heart rate into a standard Bluetooth signal).',
      'Pull down to refresh this list — the Watch should now appear as a heart-rate sensor.',
    ],
    note:
      'Wear OS and other smartwatches vary; look for a "broadcast heart rate" option or a similar broadcaster app.',
  },
  {
    id: 'not-listed',
    title: "Device not listed?",
    intro:
      'Any sensor that broadcasts standard Bluetooth LE heart rate should work.',
    steps: [
      'Make sure the device is awake and actively broadcasting heart rate (not just powered on).',
      'Disconnect it from any other app or watch, then pull down to refresh this list.',
      'Still stuck? Get in touch and tell us the device — see Support & feedback on the About screen.',
    ],
  },
];
