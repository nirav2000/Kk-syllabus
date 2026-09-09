# Curious Path

A calm, adaptive KS2 maths and English learning app. It has no learner-visible scores, timers, streaks, year-group questions, or harsh wrong-answer marks.

Features include adaptive sessions, rotating scheduler tie-breaks, prerequisite gates, mastery requiring hardest-tier evidence, later review, a PIN-gated grown-up dashboard, local persistence, and offline support. The original questions broadly align with England's national curriculum without reproducing proprietary scheme wording.

## Run

```bash
npm test
npm run serve
```

Open http://localhost:8000. The GitHub Pages build keeps progress only in that browser.

## Concept investigation: area and perimeter

Open “Same garden. Different fence?” on the home screen. The lesson follows prediction, tile exploration, explicit explanation, numeric application, a carpet/trim transfer question, and a learner-built counterexample. All diagrams use calculated unit squares and boundary lengths. There is no runtime AI, microphone capture or external reward link.

The Finish control is available throughout. Lesson steps, hints and attempts are saved locally as they change. Parent evidence distinguishes independent first attempts from supported/revised answers; finishing a lesson does not award mastery. Spoken explanations are not automatically assessed. Existing profiles remain intact.

Tests independently enumerate exposed tile edges, validate counterexamples, and guard against reporting supported attempts as independent understanding. Real-device visual/touch verification is still needed. The earlier quiz placement and broad curriculum remain prototypes; this milestone does not replace their algorithms or add backend/offline infrastructure.
