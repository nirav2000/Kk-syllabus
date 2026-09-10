# Optional explanation service

The Pages app works without this service. The parent helper can already copy a prompt for an adult's own ChatGPT session. This document describes deployment of the optional OpenAI API service, not a claim it is running.

## Requirements

- Firebase CLI access to `kk-syllabus`, permission to deploy functions and manage secrets, and an appropriate billing plan. No Firebase administration credential is available in this coding session.
- An OpenAI API project/key and a model with Responses API structured-output support. ChatGPT plan usage does not provision this API key.
- A parent account matching the UID already in `src/firebase-config.js` and `functions/index.js`.

## Deploy from a trusted terminal

```sh
node content/build.mjs
node content/build-ai-catalog.mjs
npm ci --ignore-scripts
npm test
npm --prefix functions install
firebase functions:secrets:set OPENAI_API_KEY --project kk-syllabus
firebase deploy --only functions:explain --project kk-syllabus
```

The deployment prompts for `OPENAI_MODEL` because it has no baked-in model default. Choose a supported model available to your API project. Set a provider budget and alert as well as the function's 20-request daily cap. Never put an API key in frontend JavaScript, a Firestore document, or GitHub. The `.gitignore` excludes local function environment and secret files.

After deployment, sign in through the parent's Save across devices panel, open Explanation helper and generate an explanation. Verify an unauthenticated caller is denied, an invalid item is rejected, the daily quota is enforced, a failed provider request produces fallback guidance, and the response is reviewed before being shown to the learner. The function targets `europe-west2`; the client uses the same fixed region.

## Data and security

Firebase authenticates the owner. The server verifies the exact owner UID; no public anonymous API proxy is created. The server's `explanation_limits` collection is intentionally denied to browser clients by the existing unmatched-path Firestore rule. Admin SDK transactions manage it; **no public Firestore rules change is needed**. CORS is restricted to the existing GitHub Pages origin, but authentication and quotas are the actual access controls.

The request body contains only a public curriculum item ID and fixed teaching approach. Unknown fields are rejected. OpenAI receives the allowlisted question, answer and hint. It receives no learner identifier, response, audio, performance or profile. The provider call sets `store: false`; this is not the same as account-level Zero Data Retention. Do not add child personal data or free text without revisiting the architecture and OpenAI's under-18 guidance. Parent review is required for teaching accuracy; generated text is escaped in the UI.

References checked during implementation:
- [OpenAI under-18 guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Firebase callable functions](https://firebase.google.com/docs/functions/callable)

This scaffold has local policy tests. Live API calls, function deployment, provider output quality and billing behaviour have not been verified.
