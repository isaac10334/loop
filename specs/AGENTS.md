# Specification workflow

Read `specs/README.md` and the selected spec. Start with one observable outcome,
owned boundary, inputs/outputs, failure semantics and executable acceptance.
Use existing public contracts before proposing an API. Preserve wire identities;
explain identity matching and authorization apart from structural type checks.

Mark proposed/implemented/verified status with scope and evidence. Keep design
questions in root `QUESTIONS.md`; keep execution progress in existing engineering
ledgers. One integrator owns shared WIT/schema edits. A spec is not a package stub
or permission to implement its follow-ups. Cut superseded prose in the same change.
