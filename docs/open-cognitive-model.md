# Open Cognitive Assessment Model

This document describes Envibe's Pymetrics-like assessment architecture. It is
designed to be similar at the system level: short game-like tasks produce
behavioral telemetry, telemetry becomes cognitive constructs, constructs become
profile traits, and reports explain the evidence behind each score.

It does **not** copy Pymetrics' proprietary games, trait labels, scoring weights,
norms, model outputs, trade dress, or decision logic.

## Why this model exists

The uploaded data bundle contains large neuropsychological task datasets and
data dictionaries. Those dictionaries expose useful open cognitive constructs:

- reaction time and variability,
- signal detection and false alarms,
- visual sequencing and errors,
- spatial span,
- design fluency and repetition,
- perceptual matching,
- learning, recall, and response consistency.

Envibe uses those constructs to build an original game-based model that can be
validated against open-data measures and then tested with your own candidate or
research data.

## Model pipeline

```text
Browser mini-game telemetry
  -> task metrics
  -> open cognitive construct scores
  -> relational style trait scores
  -> system-assigned profile match
  -> explainable report and fairness monitoring
```

## Current mini-games

| Mini-game | Inspired construct family | Primary task metrics |
| --- | --- | --- |
| Balloon Pop | risk-reward learning, inhibition | burst rate, banked points, exploration, learning after pop |
| Choice Dots | choice reaction time | accuracy, median response time, response consistency |
| Trail Path | trail-making/sequencing | completion time, errors, error control, speed balance |
| Spatial Span | visuospatial working memory | max correct span, accuracy, average errors |
| Pattern Match | visual search/discrimination | accuracy, error rate, median response time |
| Design Grid | design fluency | unique rate, repeat rate, response time |
| Auditory Screen | signal detection | hit rate, false alarms, median hit response time |

## Construct layer

The current model version is:

```text
open-cognitive-relational-v1
```

It computes nine open cognitive constructs:

| Construct | Purpose |
| --- | --- |
| Risk-reward learning | Balancing exploration, restraint, reward, and loss |
| Attention control | Attending to relevant visual/auditory signals |
| Processing speed | Efficient response timing across simple tasks |
| Response inhibition | Avoiding false alarms, overextension, and repeated behavior |
| Cognitive flexibility | Sequencing, novelty, and adaptation after feedback |
| Working memory | Holding non-verbal context across short sequences |
| Perceptual discrimination | Detecting target patterns among distractors |
| Generativity | Producing new non-verbal designs |
| Feedback learning | Adjusting behavior after outcomes |

## Trait layer

Constructs are transparently weighted into Envibe's relational-style traits:

- Relational attunement
- Emotional calibration
- Response flexibility
- Patience under ambiguity
- Boundary clarity
- Social learning orientation

These are product hypotheses, not clinical diagnoses. The weights are readable
in `lib/scoring.ts` and should be validated before consequential use.

## How uploaded data should be used

The uploaded dictionaries should support:

1. **Validation mapping**
   - Compare Envibe task metrics to analogous open task measures.
   - Example: Choice Dots response time vs. `CRT` / `SRT` RT measures.

2. **Distribution calibration**
   - Estimate plausible ranges for reaction time, errors, completion, and
     variability.
   - Avoid hard-coding raw participant data into the app.

3. **Fairness monitoring**
   - Use demographic fields only for aggregate drift checks.
   - Do not expose protected or health-related attributes in candidate reports.

4. **Future mini-game design**
   - Build original non-word tasks inspired by Trail Making, Spatial Span,
     Hidden Patterns, Identical Pictures, Design Fluency, and reaction-time
     paradigms.

## How to test your own data

For a future import pipeline, map your data into the same three levels:

1. **Task metric columns**
   - e.g. `accuracy`, `medianResponseMs`, `errorRate`, `completion`,
     `repeatRate`, `maxCorrectSpan`.

2. **Construct inputs**
   - map your task metrics to the nine construct families above.

3. **Trait/profile outputs**
   - run the same construct-to-trait and profile-matching formulas.

This lets your data be scored in a way that is Pymetrics-like in architecture
while remaining transparent, inspectable, and non-proprietary.

## Guardrails

- Do not describe the output as a Pymetrics score.
- Do not claim clinical validity without validation.
- Do not use raw uploaded participant data in source control.
- Do not automate high-stakes decisions from these scores alone.
- Use the model as an explainable research and product prototype until validated.
