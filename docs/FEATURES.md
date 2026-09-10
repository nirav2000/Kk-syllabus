# Features and delivery roadmap

Updated 10 September 2026. This file distinguishes working features from scaffolds and future work. Main is the delivery branch; GitHub Pages publishes the browser app. The original Flutter/FastAPI/SQLite/Docker architecture has not been implemented: this repository currently uses a static JavaScript app with local storage and optional Firestore.

## Available in this release

| Area | Behaviour | Limits |
|---|---|---|
| Gentle learning | No learner scores, countdowns, streaks or harsh wrong-answer marks; Finish stays available | Content quality needs ongoing human review |
| Practice path | Eligible topics rotate on ties; questions sampled across three tiers; mixed review | Full block-adaptive placement and per-strand Elo remain future work; the misleading starting-level label was removed |
| Answer ordering | Fisher–Yates shuffle on each presentation; order saved in new events | Earlier events cannot reconstruct an order that was never recorded |
| Corrections | Explanations before answering and supported later retry after an error | Supported answers do not independently establish quiz mastery |
| Maths/English | 17 objectives and 93 questions | Original 10 topics have only three items each; seven new topics have nine each |
| New maths | Rounding, decimal units, fractions of amounts, percentages, time, ratio, inverse operations | Mostly short numeric applications; expand diagrams and richer transfer problems next |
| Garden investigation | Predict, rearrange tiles, trace the whole perimeter, explain, apply, transfer and build a counterexample | Spoken explanations are not assessed |
| Word workshop | 87 words, with meanings and original context sentences across Years 1–7 difficulty bands | Starter selection only, including advanced 11+ vocabulary; not a complete exam syllabus or validated attainment measure |
| Spelling | Tap-to-hear word and sentence; typed answer; reveal-to-practise; calm correction | Audio depends on device/browser voice availability; no microphone recognition yet |
| Vocabulary | Context and meaning retrieval with shuffled definitions | Add synonyms, antonyms, morphology and richer usage questions |
| Spaced review | Separate spelling/meaning history; due reviews plus new learning; learnt words return | Five due unassisted recalls on separate dates spanning at least 14 days are required; intervals 1, 3, 7, 14, 30 days. No permanent dropping of words |
| Timing | Active response time, total elapsed time and interruptions for new attempts | Active time includes reading/listening/typing; hidden tabs and parent panels pause it. No diagnosis inferred; no mastery speed threshold |
| Parent reports | Overall summary, topic and session filters, question detail, sequential replay, JSON export | Replay reconstructs recorded attempts, not video or keystrokes. Old missing measurements remain unknown |
| Word lists | To learn / learning / learnt, next review dates, parent-selected difficulty range | Bands appear only in parent controls; no child age/year question |
| Profiles | PIN-protected tests, learners, switching and safe test resets | PIN is local privacy protection, not a strong security boundary |
| Persistence | Local-first events, optional owner-only Firestore, idempotent merging | Live authenticated Firestore requires the parent's configured account; incremental cloud paging remains future work |
| Explanation helper | Parent selects question and teaching approach, sees built-in hint and can copy a tailored prompt | Live API generation is an optional backend scaffold, not activated by Pages deployment |

## Optional AI backend: implemented but not deployed

`functions/` supplies a Firebase callable function and strict request policy. The browser calls a fixed project endpoint using Firebase Auth. The server accepts only known curriculum item IDs and one of four teaching approaches. It sends public curriculum text, never the learner's name, voice, free text, history or Firebase UID, to OpenAI. The key is held in Secret Manager. Each parent is limited to 20 requests per UTC day; attempts consume quota even if the provider fails. Generated output is displayed as plain text in the parent panel and requires parent review before showing it to the child. No tools, links, arbitrary chat, or automatic mastery decisions.

This does not connect directly to a ChatGPT subscription. It uses the separately configured OpenAI API. See [AI setup](AI_SETUP.md). No provider calls, secret provisioning, Firebase billing changes or function deployment were performed in this release. Policy tests do not constitute a live integration test.

## Prioritised future work

1. **Broader, audited word bank:** complete DfE spelling-pattern coverage and larger original 11+ vocabulary sets; antonyms/synonyms, word families, roots, prefixes, suffixes, and word usage. There is no claim that 87 words cover every 11+ provider or difficulty.
2. **Real adaptive placement:** independent per-strand block placement, instructional-band routing, early exit, oscillation handling, and appropriate starting hints. Keep ages off the learner screen.
3. **Concept demonstrations:** draggable base-ten blocks, fraction bars, number-line rounding, ratios with counters, worked examples followed by transfer. Add three or more items per tier to every legacy objective.
4. **Voice spelling on iPhone/iPad:** explicit tap-to-record and stop, letter-name transcript confirmation, editable recognition result, keyboard fallback, parent opt-in, and independent checks of B/D/P/T and M/N recognition. Do not grade normal whole-word dictation as evidence of letter-by-letter spelling. Test actual iPhone and iPad Pro microphones/Safari and privacy behaviour before shipping.
5. **AI activation:** provision server secrets/model, deploy and authenticate, test budget/error/refusal behaviour, and review generated teaching quality before enabling for routine use. A future free-text child interface would need additional privacy and safeguarding work; it is not this release.
6. **Richer reports:** rolling trends, topic-specific response-time comparisons, first-answer position patterns, unfinished-session records, visual replay of diagrams, and export/import backups.
7. **Operations:** incremental cloud synchronisation, stronger parent auth where needed, conflict review, backup restore tests. Offline work is not a priority at the user's request.
8. **Review cadence:** perform first-principles correctness, accessibility and content reviews at each substantive release. This document is a roadmap, not a scheduled automation.

## Verification boundary

Automated tests check shuffling, active timing, spaced-review progression and demotion, duplicate replay, profile separation, numeric answers independently derived from question text, and AI request restrictions. Browser checks exercise the deployed interface. Automated browser checks cannot certify iOS voice availability, physical device typing suggestions, hearing audio, or real child learning outcomes.
