# Uploaded Neuropsych Data Inventory and Product Mapping

This note summarizes the uploaded workbook/data-dictionary bundle and how it can
support the Envibe relational-style assessment product. It intentionally
describes metadata and product use cases only; raw participant-level rows should
remain outside source control.

## Upload inventory

- Data workbooks found: 63 `.xlsx` files.
- Data dictionaries found: 68 `.csv` files.
- Typical workbook shape: about 1,926-1,942 rows, with task-specific column
  counts ranging from low hundreds to more than 1,400 columns.
- Dictionary format: tab-delimited despite the `.csv` extension.
- Common dictionary fields:
  - `col_name`
  - `col_pretty_name`
  - `description`
  - `task`
  - `session`
  - `data_type`
  - `data_range`
  - `data_units`
  - `full_measure`
  - `core_measure`
  - `col_type`

Each dictionary includes roughly 48 shared demographic/clinical columns plus
task-specific measures. Shared fields include age, gender, handedness, computer
use, education, race/ethnicity flags, mood/anxiety/cognitive questionnaire
scores, health variables, and COVID-related fields. Treat those fields as
sensitive and use them only for de-identified analysis, validation, and
aggregate fairness monitoring.

## File coverage notes

- Most uploaded workbooks have a matching data dictionary.
- `shared_ST_2025_07_14` was uploaded, but a matching `dict_shared_ST...`
  dictionary was not found.
- Some dictionaries do not currently have a matching uploaded workbook,
  including `MR`, `Sem`, and some combined `LogMem`/`VF` dictionary files.

## Task inventory

| Task code | Cognitive task | Representative measures | Product relevance |
| --- | --- | --- | --- |
| `AS` | Auditory Screen | last intensity, minimum correct intensity, accuracy, hit count, RT mean/median/SD | Listening threshold, attention, response consistency |
| `CRT` | Choice Reaction Time | mean RT, RT SD, side RT difference, hits, misses, incorrect count | Response speed, consistency, inhibition under choice |
| `SRT` | Simple Reaction Time | trial count, hit/miss count, RT mean/median/SD, side RT difference | Baseline processing speed and motor response consistency |
| `TMA` / `TMB` | Trail Making A/B | completion time, error count, max target, circuitousness, drawing velocity, path length | Sequencing, cognitive flexibility, planning, error monitoring |
| `SS` | Spatial Span | correct count, max span, mean span, adjusted span, response timing | Visuospatial working memory and sequence retention |
| `HP` | Hidden Patterns | response count, hit count, incorrect count, adjusted hit count, RT stats | Visual search, pattern detection, persistence |
| `IP` | Identical Pictures | response count, hit count, incorrect count, adjusted hit count, RT stats | Perceptual speed and visual discrimination |
| `DF` | Design Fluency | total/legal/unique/repeated pattern count, RT stats | Generativity, novelty, inhibition of repetition |
| `FT` | Finger Tapping | tap count, tap failures, intertap interval, downtime, movement initiation slowing | Motor speed, fatigue, consistency |
| `FDraw` / `FD_*` | Figure Drawing | drawing/reproduction/recognition measures, path and timing measures | Visual construction, memory, planning |
| `V` / `SN` / `S` / `S_SH` | Symbol/number and screening tasks | task-specific accuracy, timing, response counts | Candidate sources for attention and interference-control mini-games |

## Mapping to Envibe relational-style traits

These mappings should be treated as product hypotheses until validated. They
are useful for deciding which mini-games to implement and which uploaded
measures can validate generated scores.

| Envibe trait | Candidate cognitive signals | Uploaded measures that can validate it |
| --- | --- | --- |
| Relational attunement | Accurate signal detection, low miss rate, careful listening | `AS.acc`, `AS.hit_ct`, `AS.min_corr_int`, `CRT.hit_ct`, `SRT.hit_ct` |
| Emotional calibration | Balanced speed/accuracy under uncertainty, restrained responding | `CRT.hit_ct`, `CRT.inc_ct`, `CRT.miss_ct`, RT variability, `AS.acc` |
| Response flexibility | Switching, adapting after errors, efficient route-finding | `TMB.comp_time`, `TMB.err_ct`, `TMB.crctness`, `DF.unq_pat_ct`, `DF.rpt_pat_ct` |
| Patience under ambiguity | Waiting for signal, avoiding impulsive false responses, steady performance | RT variability, miss/incorrect counts, `AS` intensity/accuracy, `HP.inc_ct`, `IP.inc_ct` |
| Boundary clarity | Stopping rules, controlled output, low perseveration/repetition | `DF.rpt_pat_ct`, trail errors, `CRT.inc_ct`, `AS` false-alarm measures |
| Social learning orientation | Learning from feedback and adjusting strategy | `DF.unq_pat_ct`, `TMB.err_ct`, `SS.adj_MS`, trail completion efficiency |

## Recommended product integration path

1. **Use the dictionaries as a measure catalog.**
   - Add a small internal metadata file that lists task code, task label,
     cognitive construct, key measures, and relevant Envibe trait mappings.
   - Do not bundle raw participant rows into the app.

2. **Use only non-word mini-games in the product.**
   - Current product uses Balloon Pop, Choice Dots, Trail Path, Spatial Span,
     Pattern Match, Design Grid, and Auditory Screen.
   - Good future additions from these files:
     - Simple Reaction Time variants.
     - Finger Tapping.
     - Figure Drawing.
     - Mental Rotation.
     - Symbol-Number / Visual Screen style tasks.

3. **Use uploaded data for validation, not copying stimuli.**
   - The data dictionaries identify constructs and scoring fields.
   - Build original browser tasks and original visual/audio stimuli.
   - Compare generated task metrics against analogous uploaded measures during
     validation.

4. **Create benchmark transforms.**
   - For each implemented mini-game, define a transform from raw telemetry to
     normalized metrics: accuracy, RT median, RT variability, error rate,
     completion, learning/adaptation, perseveration.
   - Later, use uploaded data distributions to calibrate plausible ranges.

5. **Keep fairness monitoring aggregate-only.**
   - Shared demographic fields can support cohort drift checks.
   - Avoid showing protected or health-related attributes in candidate reports.
   - Use minimum group-size thresholds before interpreting differences.

## Suggested next mini-games

| Priority | Mini-game | Why it fits |
| --- | --- | --- |
| 1 | Finger Tapping | Adds motor consistency, fatigue, and tempo control without words. |
| 2 | Figure Drawing-inspired copy task | Adds visual construction, planning, and precision without naming or recall. |
| 3 | Mental Rotation | Adds spatial transformation and flexible perspective taking. |
| 4 | Symbol-Number visual pairing | Adds visual association and response speed with icon/pattern prompts only. |
| 5 | Visual Screen | Adds baseline visual acuity/attention checks for quality control. |

## Implementation caution

This bundle appears to include neuropsychological, demographic, and clinical
variables. Before using it for model calibration or reporting, confirm the
license, consent scope, de-identification status, and whether any downstream use
is restricted. The product should remain descriptive and explainable, not a
clinical diagnostic tool or an automated decision system.
