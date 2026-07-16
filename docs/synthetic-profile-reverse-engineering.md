# Synthetic Profile Reverse Engineering

This workflow turns the uploaded neuropsych-style task exports into
person-like, synthetic cognitive/relational profiles. It is intended to help us
make sense of the data as if the rows represented people, while still treating
the bundle as synthetic and non-diagnostic.

## What the script does

`scripts/reverse_engineer_synthetic_profiles.py`:

1. Reads uploaded `shared_*.xlsx` workbooks and `dict_shared_*.csv` data
   dictionaries.
2. Uses the dictionaries to locate task measures by `task` and `core_measure`.
3. Selects open cognitive measures that align with the current Envibe model:
   - Auditory Screen
   - Choice Reaction Time
   - Simple Reaction Time
   - Trail Making A/B
   - Spatial Span
   - Hidden Patterns
   - Identical Pictures
   - Design Fluency
   - Digit Span as an optional working-memory proxy
4. Converts each selected measure to a within-dataset percentile score.
   - Higher-is-better measures score higher at higher percentiles.
   - Lower-is-better measures, such as reaction time or error count, are
     inverted.
5. Aggregates normalized measures into open cognitive constructs.
6. Maps constructs into Envibe relational traits.
7. Assigns the closest relational profile.
8. Writes pseudonymous synthetic profile examples and archetype summaries.

## How to run

Place the uploaded files in a local directory, for example:

```text
uploads/
  shared_CRT_2025_07_14_665b.xlsx
  dict_shared_CRT_2025_07_14_66f7.csv
  ...
```

Then run:

```bash
npm run analyze:synthetic-profiles -- --uploads-dir uploads
```

Or call the script directly:

```bash
python3 scripts/reverse_engineer_synthetic_profiles.py \
  --uploads-dir /path/to/uploaded/files \
  --out-dir .analysis/synthetic-profiles \
  --limit-profiles 25
```

Outputs:

```text
.analysis/synthetic-profiles/synthetic-profiles.json
.analysis/synthetic-profiles/synthetic-profiles.md
```

The output directory is intentionally ignored by Git.

## Construct model

The reverse-engineering script scores these constructs:

| Construct | Source task families |
| --- | --- |
| Attention control | Auditory Screen, CRT, Hidden Patterns, Identical Pictures |
| Processing speed | CRT, SRT, Auditory Screen, Trail Making |
| Response inhibition | CRT errors/misses, Trail errors, Design Fluency repeats |
| Cognitive flexibility | Trail Making path efficiency, Design Fluency uniqueness |
| Working memory | Spatial Span, optional Digit Span proxy |
| Perceptual discrimination | Hidden Patterns, Identical Pictures |
| Generativity | Design Fluency legal/unique pattern production |
| Feedback learning | Design Fluency, Trail B, Spatial Span proxies |
| Risk-reward learning proxy | Inhibition/flexibility proxies where direct risk-task data is absent |

## Trait interpretation

The script maps constructs into the same relational-style trait families used in
the product:

- Relational attunement
- Emotional calibration
- Response flexibility
- Patience under ambiguity
- Boundary clarity
- Social learning orientation

Each generated profile includes:

- construct scores,
- trait scores,
- closest relational profile match,
- a short narrative,
- evidence snippets from the strongest contributing measures.

## Important limitations

- This is **not** a Pymetrics score.
- This does not copy Pymetrics' proprietary model, games, norms, or outputs.
- The uploaded rows are treated as synthetic behavioral records.
- Percentile scores are relative to the uploaded bundle, not to a validated
  population norm.
- Some constructs, especially risk-reward learning, are only proxies when the
  uploaded task battery does not contain a direct risk/reward game.
- Do not use the generated profiles for clinical diagnosis, hiring decisions, or
  high-stakes decision automation.

## Why this helps

This gives us a way to reverse-engineer broad behavioral patterns from the same
open cognitive data structure you provided:

```text
raw task measures
-> normalized cognitive constructs
-> relational-style traits
-> person-like synthetic archetypes
```

That makes the data interpretable in product terms while keeping the model
transparent, inspectable, and non-proprietary.
