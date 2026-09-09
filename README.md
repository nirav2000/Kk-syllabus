# Curious Path

A calm, adaptive KS2 maths and English learning app. It has no learner-visible scores, timers, streaks, year-group questions, or harsh wrong-answer marks.

Features include adaptive sessions, rotating scheduler tie-breaks, prerequisite gates, mastery requiring hardest-tier evidence, later review, a PIN-gated grown-up dashboard, local persistence, and offline support. The original questions broadly align with England's national curriculum without reproducing proprietary scheme wording.

## Run

```bash
npm test
npm run serve
```

Open http://localhost:8000. The GitHub Pages build saves progress locally, with optional parent-account Firestore synchronisation.

## Concept investigation: area and perimeter

Open “Same garden. Different fence?” on the home screen. The lesson follows prediction, tile exploration, explicit explanation, numeric application, a carpet/trim transfer question, and a learner-built counterexample. All diagrams use calculated unit squares and boundary lengths. There is no runtime AI, microphone capture or external reward link.

The Finish control is available throughout. Lesson steps, hints and attempts are saved locally as they change. Parent evidence distinguishes independent first attempts from supported/revised answers; finishing a lesson does not award mastery. Spoken explanations are not automatically assessed. Existing profiles remain intact.

Tests independently enumerate exposed tile edges, validate counterexamples, and guard against reporting supported attempts as independent understanding. Real-device visual/touch verification is still needed. The earlier quiz placement and broad curriculum remain prototypes; the garden milestone does not replace their algorithms.

## Local + Firestore saving

Firebase project: `kk-syllabus`. This version supports one shared learner under the configured parent account. Only learning records and the learner nickname are uploaded. The parent PIN remains device-local. No Analytics SDK, measurement ID, password field, or microphone recording is included in learning data.

### One-time Firebase console setup

1. Create Cloud Firestore (if not already created).
2. Enable Authentication → Sign-in method → Email/Password. Use the existing parent user whose UID is `2AJSfYdtg5URWHv7HCzpNMmKIlg2`.
3. Publish the exact contents of [firestore.rules](firestore.rules) in Firestore Database → Rules. These are the previously proposed ownership rules with the UID filled in. Preserve any unrelated application rules if this project is shared. Do not use public test-mode rules.
4. Open the app → Grown-up view → Save across devices. Enter the parent email and password. Repeat on each trusted device using the same parent account. The password is passed to Firebase Authentication and is not saved by this app. Firebase retains the sign-in session on that device.
5. Wait for “Synced with Firestore”. Confirm that an answer or garden attempt appears under `families/{parentUid}/learners/primary/events`. On a second device, sign in and use Sync now, then reopen the lesson or dashboard to inspect its progress.

Cloud permissions/rules have NOT been deployed by committing this repository. Publishing the rules requires Firebase console access. No Firebase password or admin/service-account credential belongs in source control.

### Storage and conflict behaviour

- Existing browser profile and garden data migrate into one atomic `curious-data-v2` local record. Previous keys remain as a migration backup until a device reset.
- Each answer/attempt has a stable event ID. Firestore stores events separately and rules permit only identical retries, never edits or deletion of existing history.
- A Firestore transaction merges the small progress metadata document. Mastery and ratings are reconstructed from the combined, deduplicated quiz events; garden hints and attempts are also merged. Event ordering uses client timestamps, then IDs, so devices should have correct clocks.
- Sync runs after local changes, on return to the app, when connectivity returns, and via Sync now. It does not claim that other devices update instantly in the background. The first version reads the family's event collection during sync; paginated/incremental sync is future work for large histories.
- Local edits made during a cloud request are merged again before saving results. A failed read is never treated as an empty cloud account. Failed uploads remain available locally and are retried.
- Disconnecting keeps both local and cloud history. “Reset this device” disconnects first and clears this app's local records and PIN; it does not delete Firestore history. Reconnecting restores cloud history. This is a local reset, not a way to create a second learner.
- The local nickname on a fresh device is combined with the existing shared learner; the existing cloud nickname takes precedence. Multi-learner account selection is not yet implemented.

Automated tests cover migrations, idempotent retries, two-device convergence, denied reads, concurrent local edits, cancellation, quota errors and preservation of supported-attempt evidence. Live authenticated Firestore and real-device checks require the parent account and have not been performed in this workspace. Firestore rules are supplied for console publication, not claimed as emulator-tested.
