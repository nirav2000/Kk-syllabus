# Comprehension Learner Sync: deployment and rollback

Previous Firestore rules are preserved in Git commit [e328b901df4141418f5c934f43469e8b57d2e85c](https://github.com/nirav2000/Kk-syllabus/tree/e328b901df4141418f5c934f43469e8b57d2e85c). This is the exact production-rule source before adding a restricted, parent-approved comprehension learner-device permission.

The new permission must **not** let learner devices read family records, change existing answers, or approve themselves. It only permits append-only comprehension answer documents with small bounded fields under Sai's events, after an owner creates an approvedDevices membership.

To use it, enable Firebase Anonymous Authentication for the kk-syllabus project (if not already enabled), have the child obtain their learner device UID, then have the parent approve it in Comprehension's Answer Ladder. The child is never asked for the parent password.

After release, inspect the deployment workflow result and ensure it created the correct rules release before claiming cloud writes work.
