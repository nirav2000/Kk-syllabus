# Content sources and known defect classes

All newly authored definitions, examples, prompts and teaching cards in this repository are original. Individual practice words and spelling-pattern scope are informed by [England's National Curriculum English spelling appendix](https://assets.publishing.service.gov.uk/media/5a7ccc06ed915d63cc65ce61/English_Appendix_1_-_Spelling.pdf), published under the Open Government Licence. Year 7/11+ difficulty assignments are editorial extensions, not official DfE word lists or exam-provider guarantees. No commercial question bank or copyrighted character has been reproduced.

Edit `words-source.tsv` and `build.mjs`, then run `node content/build.mjs`. The generated JS files are versioned curriculum data. Every new numeric answer is calculated by the builder and independently re-derived from its question by `tests/content-pipeline.test.js`, without importing the builder. `npm test` checks generated output is up to date. Build the AI catalogue after content changes as well.

Defect classes to review on each release:

- Never rely on correct-answer position. Shuffle all presented choices and preserve their exact displayed order in history.
- Do not infer guessing from speed alone. Reading, hearing and motor demands affect timing. Missing legacy timing is unknown, not zero.
- A revealed answer or corrected retry is supported evidence; it must not independently certify mastery.
- Same-day or not-yet-due repeats must not grow spaced-retrieval streaks. Learnt words must remain eligible for maintenance.
- Do not let a finished difficulty band hide the next one. Rotate due-date ties and reserve new-word space.
- Avoid distractors whose meaning overlaps the target. The generator excludes ephemeral/transient, diligent/meticulous, cautious/vigilant, generous/benevolent, certain/definite and coherent/concise/eloquent groups from competing with one another.
- Possessive apostrophe questions need an explicit number of owners; both singular and plural possessives can otherwise be valid.
- Worked examples should teach the approach without duplicating the tested numbers. The new decimal-units items are intentionally foundational, not complete decimal curriculum coverage.
- Asking for help must never be framed as a personal flaw. Do not treat hesitation, disability, or voice recognition errors as lack of knowledge.
- Parent-created test data must remain in a test profile. Never include real learner identifiers in content, tests or commits.

This release includes structural and arithmetic checks plus an author review of the small narrative word bank. A separate qualified educational review and richer narrative adversarial review remain needed before describing the syllabus as comprehensive or validated.
