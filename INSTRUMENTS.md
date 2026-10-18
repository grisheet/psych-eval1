# Instrument registry and calculation specification

All content in `src/domain/registry.ts` is **original, unreviewed demonstration content — not for clinical use**. No established test items, proprietary norms, or clinical cutoffs are included. Original items share the repository’s MIT license. This is not permission to add third-party test material.

The registry stores identifier, name, version, language, population, purpose, recall period, provenance, license, administration requirements, section/item definitions, response options, missing-response behavior, algorithm version, interpretation source, limitations, and review status/reviewer/date. A null reviewer/date means no clinical review has occurred.

## Modules

| Identifier    | Purpose/domain                                                                   |
| ------------- | -------------------------------------------------------------------------------- |
| intake        | Core concerns, context, self-reported history, functioning, strengths, and goals |
| mood          | Mood and daily rhythm                                                            |
| anxiety       | Worry and uncertainty                                                            |
| stress        | Stress and demands                                                               |
| sleep         | Sleep and rest                                                                   |
| attention     | Focus and organization                                                           |
| trauma        | Difficult experiences; disclosure never required                                 |
| ocd           | Repetitive thoughts and actions                                                  |
| substances    | Substance-use concerns                                                           |
| eating        | Food and body concerns                                                           |
| perception    | Unusual experiences                                                              |
| activation    | Energy and activation                                                            |
| functioning   | Daily activities                                                                 |
| wellbeing     | Quality of life                                                                  |
| relationships | Connection and support                                                           |
| strengths     | Strengths and coping                                                             |
| goals         | Participant-defined next steps                                                   |

The optional modules share a deliberately simple conversation-guide template. Breadth of topic coverage is not a comprehensive psychological evaluation. All current versions are `1.0.0`, English, adult-only. These modules do not ask safety-screening questions or establish immediate safety.

## Pure calculation: `completeness-1.0.0`

1. Validate item IDs, allowed response states, input types, choices, lengths, and numeric/date boundaries against the persisted instrument definition.
2. Remove conditional answers whose condition is no longer visible. Never include clinician-only or calculated fields in participant input.
3. Count visible participant prompts containing a nonempty answered value. Numeric zero is a legitimate answer. Empty text/arrays are incomplete.
4. Preserve every missing state: `unanswered`, `prefer-not`, `not-applicable`, `unknown`.
5. Return the count, visible-item total, missing item IDs/states, instrument version, and algorithm version. Always return `score: null`.

This count is not a health score. It has no thresholds, severity labels, norms, percentiles, probabilities, or clinical interpretation. There is no missing-response imputation and no aggregation across instruments. All optional prompts may be skipped.

## Versioning

`instrument_version.definition` is immutable at the database level. Each session references the exact version ID used at start. Disabling an instrument blocks new starts but preserves existing drafts. New versions must get new IDs; the seed never overwrites an existing version. Unknown algorithm versions fail closed.

## Adding a real measure later

A qualified professional must verify exact language, item ordering, recall period, permitted use/licensing, intended population, administration constraints, missing-item rules, algorithm, interpretation source, cutoff boundaries, and reporting language. Record the source and independent sign-off. Implement and test its scoring in a separate pure module with reference examples before making it available. Merely changing a review-status label is not sufficient: the current engine calculates only nonclinical completeness.

## Engine limits

Single choice, multiple choice, Likert-style choice, bounded integers, short/long text, dates, conditional items, explicit missing states, section navigation, review-before-submit, server drafts, and version pinning are implemented. Clinician-only and calculated field definitions are protected against participant writes, but generic in-questionnaire clinician editing and arbitrary calculated-field rendering are not implemented. Structured clinician observations are entered in the report editor instead.
