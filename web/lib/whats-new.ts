// The "What's new" list behind the glowing button at the top of the app.
//
// Add an entry (newest first) whenever a change is something Isaac or his
// client would notice. Write it for the person using the app: what it does
// for them, not how it was built. When the change adds or changes something
// they can do, give it `steps` so "Show me" can walk them through it.
//
// A step finds its spot on screen with `target` (a CSS selector). If the
// spot isn't on the current page, the tour first goes to `route`, or follows
// the first link matching `follow` (e.g. "open any batch"). A step marked
// `optional` is skipped when its spot doesn't exist, e.g. a notice that only
// shows up for some batches.

export interface WhatsNewStep {
  title: string;
  body: string;
  target?: string;
  route?: string;
  follow?: string;
  optional?: boolean;
}

export interface WhatsNewEntry {
  /** Stable and unique: it's how the app remembers what you've already seen. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  summary: string;
  steps?: WhatsNewStep[];
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: "2026-10-07-stage-timing",
    date: "2026-10-07",
    title: "The app now learns how long each strain takes",
    summary:
      "Every time a batch moves to its next stage, the app notes how many days it took. Over time it builds a normal range for each strain, points out batches that ran unusually fast or slow, and asks whether anything changed so it can learn the likely reasons.",
    steps: [
      {
        title: "Open any batch",
        body: "Timing is tracked automatically. You don't need to log anything new; just keep moving batches to their next stage like you do now.",
        route: "/batches",
        target: ".kanban",
      },
      {
        title: "Stage timing",
        body: "Each step this batch has been through, how many days it took, and what's normal for this strain. \"Learning\" means there aren't enough finished batches yet to say what's normal (it needs 3).",
        follow: ".kanban .chip-link",
        target: '[data-tour="batch-stage-timing"]',
      },
      {
        title: "\"Did any parameters change?\"",
        body: "When a step runs noticeably longer or shorter than usual, this small notice appears. Tap Yes to pick what changed (temperature, substrate, and so on), No if nothing did, or × to hide it. Runs where something changed are left out of the averages, and the reasons are remembered.",
        target: ".timing-prompt",
        optional: true,
      },
      {
        title: "Averages for the whole strain",
        body: "Tap the strain name on a batch to get here. This shows the average days for each step, the typical range, and how confident the app is. Confidence goes up as more batches finish with similar timing.",
        follow: '.hero-meta a[href^="/strains/"]',
        target: '[data-tour="strain-stage-timing"]',
      },
      {
        title: "Alerts and stickers, once it's sure",
        body: "When confidence reaches 70%, these switches unlock. Alerts list batches due to change stage soon at the top of the Batches page, and labels lets you print stickers for the next stage ahead of time.",
        target: '[data-tour="strain-automation"]',
      },
    ],
  },
  {
    id: "2026-10-05-labels-6x4",
    date: "2026-10-05",
    title: "Labels print on 6×4 stickers by default",
    summary:
      "Batch and harvest labels now fit 6×4 inch label stock out of the box, with a bigger, crisper QR code that scans from further away. Smaller sizes are still available on the print page.",
    steps: [
      {
        title: "Print a batch label",
        body: "Open any batch and tap Print QR. The label opens ready to print on 6×4 stock; pick another size at the top of that page if you need one.",
        route: "/batches",
        follow: ".kanban .chip-link",
        target: ".batch-action-dock",
      },
    ],
  },
  {
    id: "2026-09-27-strain-wheel-zoom",
    date: "2026-09-27",
    title: "The strain wheel stays still and magnifies where you point",
    summary:
      "On the Strains page, the color wheel no longer spins. Moving your finger or mouse over it enlarges the slices nearby so names are easier to read.",
    steps: [
      {
        title: "Strain wheel",
        body: "Touch or hover anywhere on the wheel to magnify that area. Tap a slice to jump to that strain.",
        route: "/strains",
        target: ".spectrum-wheel",
      },
    ],
  },
];
