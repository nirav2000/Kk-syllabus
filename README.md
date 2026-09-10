# Curious Path

A calm, adaptive KS2 maths and English learning app. It has no learner-visible scores, timers, streaks, year-group questions, or harsh wrong-answer marks.

**Current release code:** 17 maths/English objectives, 93 questions, and an 87-word spelling/vocabulary starter bank across Years 1–7 difficulty bands. New parent reports include active response times, topic/question drill-downs and attempt replay. See [current features and roadmap](docs/FEATURES.md) for precise coverage and limitations, including experimental parent-enabled voice spelling and clearer profile controls. This is not yet a complete Year 1–7 or 11+ syllabus.

Features include adaptive sessions, rotating scheduler tie-breaks, prerequisite gates, mastery requiring hardest-tier evidence, later review, a PIN-gated grown-up dashboard, local persistence, and offline support. The original questions broadly align with England's national curriculum without reproducing proprietary scheme wording.

## Run

```bash
npm ci --ignore-scripts
npm test
npm run serve
```

Open http://localhost:8000. The GitHub Pages build saves progress locally, with optional parent-account Firestore synchronisation.

## Concept investigation: area and perimeter

Open “Same garden. Different fence?” on the home screen. The lesson follows prediction, tile exploration, explicit explanation, numeric application, a carpet/trim transfer question, and a learner-built counterexample. All diagrams use calculated unit squares and boundary lengths. The learning loop works without runtime AI. The optional parent-reviewed explanation backend is documented in [AI setup](docs/AI_SETUP.md); it is not deployed by publishing GitHub Pages. The separate voice-spelling feature uses the browser microphone only after parent opt-in and a learner tap. There is no external reward link.

The Finish control is available throughout. Lesson steps, hints and attempts are saved locally as they change. Parent evidence distinguishes independent first attempts from supported/revised answers; finishing a lesson does not award mastery. Spoken explanations are not automatically assessed. Existing profiles remain intact.

Tests independently enumerate exposed tile edges, validate counterexamples, and guard against reporting supported attempts as independent understanding. Real-device visual/touch verification is still needed. Full adaptive placement remains planned; the home screen now says “Begin today’s path” rather than claiming a starting-level assessment.

## Local + Firestore saving

Firebase project: `kk-syllabus`. This version supports separate test and learner profiles under the configured parent account. Only learning records and the learner nickname are uploaded. The parent PIN remains device-local. No Analytics SDK, measurement ID, password field, or microphone recording is included in learning data.

### One-time Firebase console setup

1. Create Cloud Firestore (if not already created).
2. Enable Authentication → Sign-in method → Email/Password. Use the existing parent user whose UID is `2AJSfYdtg5URWHv7HCzpNMmKIlg2`.
3. Publish the exact contents of [firestore.rules](firestore.rules) in Firestore Database → Rules. These are the previously proposed ownership rules with the UID filled in. Preserve any unrelated application rules if this project is shared. Do not use public test-mode rules.
4. Open the app → Grown-up view → Save across devices. Enter the parent email and password. Repeat on each trusted device using the same parent account. The password is passed to Firebase Authentication and is not saved by this app. Firebase retains the sign-in session on that device.
5. Wait for “Synced with Firestore”. Confirm that an answer or garden attempt appears under `families/{parentUid}/learners/{profileId}/events`. On a second device, sign in and use Sync now, then reopen the lesson or dashboard to inspect its progress.

Cloud permissions/rules have NOT been deployed by committing this repository. Publishing the rules requires Firebase console access. No Firebase password or admin/service-account credential belongs in source control.

### Storage and conflict behaviour

- Existing browser profile and garden data migrate into one atomic `curious-data-v2` local record. Previous keys remain as a migration backup until a device reset.
- Each answer/attempt has a stable event ID. Firestore stores events separately and rules permit only identical retries, never edits or deletion of existing history.
- A Firestore transaction merges each profile’s small progress metadata document. Mastery and ratings are reconstructed from the combined, deduplicated quiz events; garden hints and attempts are also merged. Event ordering uses client timestamps, then IDs, so devices should have correct clocks.
- Sync runs after local changes, on return to the app, when connectivity returns, and via Sync now. It does not claim that other devices update instantly in the background. The first version reads the family's event collection during sync; paginated/incremental sync is future work for large histories.
- Local edits made during a cloud request are merged again before saving results. A failed read is never treated as an empty cloud account. Failed uploads remain available locally and are retried.
- Disconnecting keeps both local and cloud history. “Reset this device” disconnects first and clears this app's local records and PIN; it does not delete Firestore history. Reconnecting restores cloud history. Use Add profile to create a separate learner.
- Profile creation and selection are parent-PIN gated. The cloud catalogue discovers profiles from other devices. Reopen the grown-up view after syncing to refresh the selector.

Automated tests cover migrations, idempotent retries, two-device convergence, denied reads, concurrent local edits, cancellation, quota errors and preservation of supported-attempt evidence. Live authenticated Firestore and real-device checks require the parent account and have not been performed in this workspace. Firestore rules are supplied for console publication, not claimed as emulator-tested.

## Test profiles and clean learner progress

On the first load of this version, the old local history is preserved as **Testing (existing history)**, using the unchanged Firestore path `learners/primary`. A separate **Explorer** learner starts empty under `learners/learner-clean-v1`. No existing event is deleted. The app initially stays in the test profile so further parental testing cannot contaminate Explorer. All devices use the same two initial profile IDs.

In Grown-up view → Learning profiles:

- Switch to Explorer when the child starts, or add a learner using a nickname.
- Add test sandboxes for experiments. A persistent TEST SANDBOX banner identifies these throughout the app. Reports show only the selected profile and never aggregate testing into a learner.
- Reset test profile archives that run and creates a new, empty test ID. Archived history is retained locally and in Firestore; it cannot merge back into the fresh run. There is no permanent learner-history deletion button.
- Restart garden lesson returns to the prediction step while keeping all previous attempts and hints. It changes lesson position, not evidence or mastery.
- Clear this device disconnects cloud and removes this app’s local profiles and PIN after confirmation. Cloud histories remain; unsynced local data will be lost.

Each profile has its own local data key, Firestore events collection and progress document. Cloud sync uploads locally held profiles, including archived tests, and discovers other devices’ profile descriptors. Requests capture a profile-specific store; switching during a request cannot redirect its results into another profile. Legacy app versions still write to primary, which is now testing history, never to the clean learner.

The existing `firestore.rules` already permits the owner to access these per-learner paths, so **no rules update is required** if the supplied rules are published. Profile type is application metadata, not a separate security role: the parent Firebase account still owns both test and learner data.
