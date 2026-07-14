import {
  AUDITORY_TRIALS,
  BALLOON_ROUNDS,
  CHOICE_DOT_TRIALS,
  DESIGN_GRID_ROUNDS,
  PATTERN_MATCH_TRIALS,
  RELATIONAL_STYLE_PROFILES,
  SPATIAL_SPAN_TRIALS,
  TRAIT_LABELS,
  TRAIL_NODES,
} from "@/lib/tasks";
import type {
  CandidateSession,
  CognitiveConstructKey,
  ConstructScore,
  ProfileMatch,
  ScoreReport,
  TaskScore,
  TelemetryEvent,
  TraitKey,
  TraitScore,
} from "@/lib/types";

const TRAIT_KEYS = Object.keys(TRAIT_LABELS) as TraitKey[];
const MODEL_VERSION = "open-cognitive-relational-v1";
const CONSTRUCT_LABELS: Record<CognitiveConstructKey, string> = {
  riskRewardLearning: "Risk-reward learning",
  attentionControl: "Attention control",
  processingSpeed: "Processing speed",
  responseInhibition: "Response inhibition",
  cognitiveFlexibility: "Cognitive flexibility",
  workingMemory: "Working memory",
  perceptualDiscrimination: "Perceptual discrimination",
  generativity: "Generativity",
  feedbackLearning: "Feedback learning",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));

  return Math.sqrt(variance);
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function scoreBalloonPop(events: TelemetryEvent[]): TaskScore {
  const rounds = events.filter(
    (event) => event.eventType === "balloon_round_completed",
  );
  const totalRounds = BALLOON_ROUNDS.length;
  const pumpCounts = rounds.map((event) => asNumber(event.payload.pumps));
  const riskRatios = rounds.map((event) => {
    const maxPumps = asNumber(event.payload.maxPumps, 12);
    return maxPumps ? asNumber(event.payload.pumps) / maxPumps : 0;
  });
  const bankedRounds = rounds.filter(
    (event) => event.payload.outcome === "banked",
  );
  const burstRounds = rounds.filter((event) => event.payload.outcome === "burst");
  const adjustedPumps = bankedRounds.map((event) =>
    asNumber(event.payload.pumps),
  );
  const bankedPoints = rounds.reduce(
    (sum, event) => sum + asNumber(event.payload.bankedPoints),
    0,
  );
  const responseTimes = events
    .filter((event) => event.eventType === "balloon_pump")
    .map((event) => asNumber(event.payload.responseMs))
    .filter((value) => value > 0);
  const afterBurstAdjustments = rounds
    .slice(1)
    .reduce<number[]>((adjustments, roundEvent, index) => {
      const previous = rounds[index];
      if (previous.payload.outcome !== "burst") {
        return adjustments;
      }

      adjustments.push(
        asNumber(roundEvent.payload.pumps) < asNumber(previous.payload.pumps)
          ? 1
          : 0,
      );

      return adjustments;
    }, []);
  const learningAdjustment = afterBurstAdjustments.length
    ? mean(afterBurstAdjustments)
    : 0.65;
  const completion = totalRounds ? rounds.length / totalRounds : 0;
  const averageRiskRatio = mean(riskRatios);
  const optimalExploration = clamp(1 - Math.abs(averageRiskRatio - 0.58) / 0.58, 0, 1);
  const burstRate = rounds.length ? burstRounds.length / rounds.length : 0;
  const riskDiscipline = 1 - burstRate;
  const pumpConsistency =
    pumpCounts.length > 1
      ? clamp(1 - standardDeviation(pumpCounts) / Math.max(mean(pumpCounts), 1), 0, 1)
      : 0.6;

  return {
    taskId: "balloon-pop",
    label: "Balloon Pop",
    metrics: {
      completion: round(completion * 100),
      averagePumps: round(mean(pumpCounts)),
      adjustedAveragePumps: round(mean(adjustedPumps)),
      burstRate: round(burstRate * 100),
      riskDiscipline: round(riskDiscipline * 100),
      optimalExploration: round(optimalExploration * 100),
      learningAfterPop: round(learningAdjustment * 100),
      pumpConsistency: round(pumpConsistency * 100),
      bankedPoints: round(bankedPoints, 0),
      medianPumpResponseMs: round(median(responseTimes), 0),
    },
    explanation:
      "Maps balloon pumping behavior to one-to-one cognitive traits: exploration, restraint, reward banking, and learning after loss.",
  };
}

function scoreAuditoryScreen(events: TelemetryEvent[]): TaskScore {
  const responses = events.filter(
    (event) => event.eventType === "auditory_response",
  );
  const signalTrials = responses.filter((event) =>
    asBoolean(event.payload.signalPresent),
  );
  const noSignalTrials = responses.filter(
    (event) => !asBoolean(event.payload.signalPresent),
  );
  const hits = signalTrials.filter((event) => asBoolean(event.payload.detected));
  const falseAlarms = noSignalTrials.filter((event) =>
    asBoolean(event.payload.detected),
  );
  const hitResponseTimes = hits
    .map((event) => asNumber(event.payload.responseMs))
    .filter((value) => value > 0);
  const hitRate = signalTrials.length ? hits.length / signalTrials.length : 0;
  const falseAlarmRate = noSignalTrials.length
    ? falseAlarms.length / noSignalTrials.length
    : 0;
  const completion = AUDITORY_TRIALS.length
    ? responses.length / AUDITORY_TRIALS.length
    : 0;
  const rtMedian = median(hitResponseTimes);
  const rtStdDev = standardDeviation(hitResponseTimes);
  const consistency =
    rtMedian > 0 ? clamp(1 - rtStdDev / Math.max(rtMedian, 1), 0, 1) : 0;

  return {
    taskId: "auditory-screen",
    label: "Auditory Screen",
    metrics: {
      hitRate: round(hitRate * 100),
      falseAlarmRate: round(falseAlarmRate * 100),
      completion: round(completion * 100),
      medianHitResponseMs: round(rtMedian, 0),
      responseConsistency: round(consistency * 100),
    },
    explanation:
      "Uses target-tone hits, false alarms, and response-time consistency to estimate listening attention and response restraint.",
  };
}

function scoreChoiceDots(events: TelemetryEvent[]): TaskScore {
  const responses = events.filter(
    (event) => event.eventType === "choice_trial_completed",
  );
  const correct = responses.filter((event) => asBoolean(event.payload.correct));
  const responseTimes = responses
    .map((event) => asNumber(event.payload.responseMs))
    .filter((value) => value > 0);
  const rtMedian = median(responseTimes);
  const rtStdDev = standardDeviation(responseTimes);
  const consistency =
    rtMedian > 0 ? clamp(1 - rtStdDev / Math.max(rtMedian, 1), 0, 1) : 0;
  const completion = CHOICE_DOT_TRIALS.length
    ? responses.length / CHOICE_DOT_TRIALS.length
    : 0;
  const accuracy = responses.length ? correct.length / responses.length : 0;

  return {
    taskId: "choice-dots",
    label: "Choice Dots",
    metrics: {
      completion: round(completion * 100),
      accuracy: round(accuracy * 100),
      errorRate: round((1 - accuracy) * 100),
      medianResponseMs: round(rtMedian, 0),
      responseConsistency: round(consistency * 100),
    },
    explanation:
      "Uses side-specific dot responses to estimate context-sensitive speed, accuracy, and response inhibition.",
  };
}

function scoreTrailPath(events: TelemetryEvent[]): TaskScore {
  const completion = events.find((event) => event.eventType === "trail_completed");
  const errors = completion ? asNumber(completion.payload.errors) : 0;
  const completionMs = completion ? asNumber(completion.payload.completionMs) : 0;
  const errorControl = completion
    ? clamp(1 - errors / Math.max(TRAIL_NODES.length, 1), 0, 1)
    : 0;
  const speedBalance = completionMs
    ? clamp(1 - Math.abs(completionMs - 12000) / 20000, 0, 1)
    : 0;

  return {
    taskId: "trail-path",
    label: "Trail Path",
    metrics: {
      completion: completion ? 100 : 0,
      completionMs: round(completionMs, 0),
      errors: round(errors, 0),
      errorControl: round(errorControl * 100),
      speedBalance: round(speedBalance * 100),
    },
    explanation:
      "Maps ordered path completion to planning efficiency, error monitoring, and flexible sequencing.",
  };
}

function scoreSpatialSpan(events: TelemetryEvent[]): TaskScore {
  const trials = events.filter(
    (event) => event.eventType === "spatial_trial_completed",
  );
  const correctTrials = trials.filter((event) => asBoolean(event.payload.correct));
  const errors = trials.map((event) => asNumber(event.payload.errors));
  const maxCorrectSpan = Math.max(
    0,
    ...correctTrials.map((event) => asNumber(event.payload.spanLength)),
  );
  const completion = SPATIAL_SPAN_TRIALS.length
    ? trials.length / SPATIAL_SPAN_TRIALS.length
    : 0;
  const accuracy = trials.length ? correctTrials.length / trials.length : 0;
  const memorySpan = clamp(maxCorrectSpan / 6, 0, 1);

  return {
    taskId: "spatial-span",
    label: "Spatial Span",
    metrics: {
      completion: round(completion * 100),
      accuracy: round(accuracy * 100),
      maxCorrectSpan: round(maxCorrectSpan, 0),
      averageErrors: round(mean(errors)),
      memorySpan: round(memorySpan * 100),
    },
    explanation:
      "Uses visual sequence recall to estimate working memory, attention holding, and context retention.",
  };
}

function scorePatternMatch(events: TelemetryEvent[]): TaskScore {
  const trials = events.filter(
    (event) => event.eventType === "pattern_trial_completed",
  );
  const correctTrials = trials.filter((event) => asBoolean(event.payload.correct));
  const responseTimes = trials
    .map((event) => asNumber(event.payload.responseMs))
    .filter((value) => value > 0);
  const completion = PATTERN_MATCH_TRIALS.length
    ? trials.length / PATTERN_MATCH_TRIALS.length
    : 0;
  const accuracy = trials.length ? correctTrials.length / trials.length : 0;

  return {
    taskId: "pattern-match",
    label: "Pattern Match",
    metrics: {
      completion: round(completion * 100),
      accuracy: round(accuracy * 100),
      errorRate: round((1 - accuracy) * 100),
      medianResponseMs: round(median(responseTimes), 0),
    },
    explanation:
      "Uses visual target matching to estimate signal detection, perceptual discrimination, and careful responding.",
  };
}

function scoreDesignGrid(events: TelemetryEvent[]): TaskScore {
  const rounds = events.filter(
    (event) => event.eventType === "design_round_completed",
  );
  const repeated = rounds.filter((event) => asBoolean(event.payload.repeated));
  const responseTimes = rounds
    .map((event) => asNumber(event.payload.responseMs))
    .filter((value) => value > 0);
  const completion = DESIGN_GRID_ROUNDS
    ? rounds.length / DESIGN_GRID_ROUNDS
    : 0;
  const uniqueRate = rounds.length ? 1 - repeated.length / rounds.length : 0;

  return {
    taskId: "design-grid",
    label: "Design Grid",
    metrics: {
      completion: round(completion * 100),
      uniqueRate: round(uniqueRate * 100),
      repeatRate: round((1 - uniqueRate) * 100),
      averageResponseMs: round(mean(responseTimes), 0),
    },
    explanation:
      "Uses new four-dot designs to estimate novelty generation, planning, and repetition inhibition.",
  };
}

function metric(taskScore: TaskScore, key: string) {
  return asNumber(taskScore.metrics[key]) / 100;
}

function speedScore(ms: number, targetMs: number, toleranceMs: number) {
  return ms ? clamp(1 - Math.abs(ms - targetMs) / toleranceMs, 0, 1) : 0.45;
}

function taskMap(taskScores: TaskScore[]) {
  return new Map(taskScores.map((taskScore) => [taskScore.taskId, taskScore]));
}

function constructEvidence(
  explanation: string,
  evidence: string[],
  sourceTasks: ConstructScore["sourceTasks"],
) {
  return { explanation, evidence, sourceTasks };
}

function buildConstructScores(taskScores: TaskScore[]): ConstructScore[] {
  const taskScoreById = taskMap(taskScores);
  const balloon = taskScoreById.get("balloon-pop") as TaskScore;
  const choice = taskScoreById.get("choice-dots") as TaskScore;
  const trail = taskScoreById.get("trail-path") as TaskScore;
  const spatial = taskScoreById.get("spatial-span") as TaskScore;
  const pattern = taskScoreById.get("pattern-match") as TaskScore;
  const design = taskScoreById.get("design-grid") as TaskScore;
  const auditory = taskScoreById.get("auditory-screen") as TaskScore;
  const riskDiscipline = metric(balloon, "riskDiscipline");
  const optimalExploration = metric(balloon, "optimalExploration");
  const learningAfterPop = metric(balloon, "learningAfterPop");
  const pumpConsistency = metric(balloon, "pumpConsistency");
  const choiceAccuracy = metric(choice, "accuracy");
  const choiceErrorControl = 1 - metric(choice, "errorRate");
  const trailErrorControl = metric(trail, "errorControl");
  const trailSpeedBalance = metric(trail, "speedBalance");
  const spatialAccuracy = metric(spatial, "accuracy");
  const spatialMemory = metric(spatial, "memorySpan");
  const patternAccuracy = metric(pattern, "accuracy");
  const designUniqueRate = metric(design, "uniqueRate");
  const designRepeatControl = 1 - metric(design, "repeatRate");
  const hitRate = metric(auditory, "hitRate");
  const falseAlarmControl = 1 - metric(auditory, "falseAlarmRate");
  const auditorySpeed = speedScore(
    asNumber(auditory.metrics.medianHitResponseMs),
    650,
    900,
  );
  const choiceSpeed = speedScore(
    asNumber(choice.metrics.medianResponseMs),
    520,
    900,
  );
  const patternSpeed = speedScore(
    asNumber(pattern.metrics.medianResponseMs),
    1800,
    2500,
  );

  const definitions: Array<{
    key: CognitiveConstructKey;
    score: number;
  } & ReturnType<typeof constructEvidence>> = [
    {
      key: "riskRewardLearning",
      score: mean([riskDiscipline, optimalExploration, pumpConsistency]),
      ...constructEvidence(
        "Balances exploration, restraint, and consistency in uncertain reward settings.",
        [
          `Balloon optimal exploration: ${balloon.metrics.optimalExploration}%`,
          `Balloon risk discipline: ${balloon.metrics.riskDiscipline}%`,
          `Pump consistency: ${balloon.metrics.pumpConsistency}%`,
        ],
        ["balloon-pop"],
      ),
    },
    {
      key: "attentionControl",
      score: mean([
        hitRate,
        falseAlarmControl,
        choiceAccuracy,
        patternAccuracy,
        spatialAccuracy,
      ]),
      ...constructEvidence(
        "Captures accurate attention to relevant visual and auditory signals.",
        [
          `Auditory hit rate: ${auditory.metrics.hitRate}%`,
          `Pattern Match accuracy: ${pattern.metrics.accuracy}%`,
          `Choice Dots accuracy: ${choice.metrics.accuracy}%`,
          `Spatial Span accuracy: ${spatial.metrics.accuracy}%`,
        ],
        ["auditory-screen", "pattern-match", "choice-dots", "spatial-span"],
      ),
    },
    {
      key: "processingSpeed",
      score: mean([auditorySpeed, choiceSpeed, patternSpeed, trailSpeedBalance]),
      ...constructEvidence(
        "Summarizes speed in reaction, detection, search, and path-completion tasks.",
        [
          `Choice median response: ${choice.metrics.medianResponseMs} ms`,
          `Auditory median hit response: ${auditory.metrics.medianHitResponseMs} ms`,
          `Pattern Match median response: ${pattern.metrics.medianResponseMs} ms`,
          `Trail speed balance: ${trail.metrics.speedBalance}%`,
        ],
        ["choice-dots", "auditory-screen", "pattern-match", "trail-path"],
      ),
    },
    {
      key: "responseInhibition",
      score: mean([
        falseAlarmControl,
        riskDiscipline,
        choiceErrorControl,
        designRepeatControl,
        trailErrorControl,
      ]),
      ...constructEvidence(
        "Estimates restraint, stopping control, low false alarms, and repetition inhibition.",
        [
          `Auditory false-alarm control: ${round(falseAlarmControl * 100)}%`,
          `Balloon risk discipline: ${balloon.metrics.riskDiscipline}%`,
          `Choice Dots error rate: ${choice.metrics.errorRate}%`,
          `Design Grid repeat rate: ${design.metrics.repeatRate}%`,
          `Trail error control: ${trail.metrics.errorControl}%`,
        ],
        [
          "auditory-screen",
          "balloon-pop",
          "choice-dots",
          "design-grid",
          "trail-path",
        ],
      ),
    },
    {
      key: "cognitiveFlexibility",
      score: mean([
        trailErrorControl,
        trailSpeedBalance,
        designUniqueRate,
        learningAfterPop,
      ]),
      ...constructEvidence(
        "Captures adaptive sequencing, novelty, and behavioral adjustment after feedback.",
        [
          `Trail Path error control: ${trail.metrics.errorControl}%`,
          `Trail Path speed balance: ${trail.metrics.speedBalance}%`,
          `Design Grid unique rate: ${design.metrics.uniqueRate}%`,
          `Learning after pop: ${balloon.metrics.learningAfterPop}%`,
        ],
        ["trail-path", "design-grid", "balloon-pop"],
      ),
    },
    {
      key: "workingMemory",
      score: mean([spatialMemory, spatialAccuracy, metric(spatial, "completion")]),
      ...constructEvidence(
        "Represents non-verbal sequence retention and context holding.",
        [
          `Spatial max correct span: ${spatial.metrics.maxCorrectSpan}`,
          `Spatial memory span: ${spatial.metrics.memorySpan}%`,
          `Spatial accuracy: ${spatial.metrics.accuracy}%`,
        ],
        ["spatial-span"],
      ),
    },
    {
      key: "perceptualDiscrimination",
      score: mean([patternAccuracy, choiceAccuracy, hitRate]),
      ...constructEvidence(
        "Captures perceptual signal discrimination across visual and auditory targets.",
        [
          `Pattern Match accuracy: ${pattern.metrics.accuracy}%`,
          `Choice Dots accuracy: ${choice.metrics.accuracy}%`,
          `Auditory hit rate: ${auditory.metrics.hitRate}%`,
        ],
        ["pattern-match", "choice-dots", "auditory-screen"],
      ),
    },
    {
      key: "generativity",
      score: mean([designUniqueRate, designRepeatControl, metric(design, "completion")]),
      ...constructEvidence(
        "Captures production of novel non-verbal designs while avoiding repetition.",
        [
          `Design Grid unique rate: ${design.metrics.uniqueRate}%`,
          `Design Grid repeat rate: ${design.metrics.repeatRate}%`,
          `Design completion: ${design.metrics.completion}%`,
        ],
        ["design-grid"],
      ),
    },
    {
      key: "feedbackLearning",
      score: mean([learningAfterPop, optimalExploration, trailSpeedBalance]),
      ...constructEvidence(
        "Estimates adjustment after outcome feedback and efficient adaptation across tasks.",
        [
          `Balloon learning after pop: ${balloon.metrics.learningAfterPop}%`,
          `Balloon optimal exploration: ${balloon.metrics.optimalExploration}%`,
          `Trail speed balance: ${trail.metrics.speedBalance}%`,
        ],
        ["balloon-pop", "trail-path"],
      ),
    },
  ];

  return definitions.map((definition) => ({
    key: definition.key,
    label: CONSTRUCT_LABELS[definition.key],
    score: round(clamp(definition.score * 100)),
    explanation: definition.explanation,
    evidence: definition.evidence,
    sourceTasks: definition.sourceTasks,
  }));
}

function constructMetric(
  constructScores: ConstructScore[],
  key: CognitiveConstructKey,
) {
  return (
    constructScores.find((constructScore) => constructScore.key === key)
      ?.score || 0
  ) / 100;
}

function buildTraitScores(
  taskScores: TaskScore[],
  constructScores: ConstructScore[],
): TraitScore[] {
  const taskScoreById = taskMap(taskScores);
  const balloon = taskScoreById.get("balloon-pop") as TaskScore;
  const choice = taskScoreById.get("choice-dots") as TaskScore;
  const trail = taskScoreById.get("trail-path") as TaskScore;
  const spatial = taskScoreById.get("spatial-span") as TaskScore;
  const pattern = taskScoreById.get("pattern-match") as TaskScore;
  const design = taskScoreById.get("design-grid") as TaskScore;
  const auditory = taskScoreById.get("auditory-screen") as TaskScore;
  const riskRewardLearning = constructMetric(
    constructScores,
    "riskRewardLearning",
  );
  const attentionControl = constructMetric(constructScores, "attentionControl");
  const processingSpeed = constructMetric(constructScores, "processingSpeed");
  const responseInhibition = constructMetric(
    constructScores,
    "responseInhibition",
  );
  const cognitiveFlexibility = constructMetric(
    constructScores,
    "cognitiveFlexibility",
  );
  const workingMemory = constructMetric(constructScores, "workingMemory");
  const perceptualDiscrimination = constructMetric(
    constructScores,
    "perceptualDiscrimination",
  );
  const generativity = constructMetric(constructScores, "generativity");
  const feedbackLearning = constructMetric(constructScores, "feedbackLearning");

  const rawScores: Record<TraitKey, number> = {
    attunement:
      100 *
      (0.34 * attentionControl +
        0.24 * perceptualDiscrimination +
        0.16 * workingMemory +
        0.14 * responseInhibition +
        0.12 * processingSpeed),
    emotionalCalibration:
      100 *
      (0.3 * riskRewardLearning +
        0.24 * responseInhibition +
        0.18 * attentionControl +
        0.16 * feedbackLearning +
        0.12 * workingMemory),
    responseFlexibility:
      100 *
      (0.34 * cognitiveFlexibility +
        0.22 * generativity +
        0.18 * feedbackLearning +
        0.14 * processingSpeed +
        0.12 * workingMemory),
    patienceUnderAmbiguity:
      100 *
      (0.3 * responseInhibition +
        0.2 * workingMemory +
        0.18 * attentionControl +
        0.18 * riskRewardLearning +
        0.14 * feedbackLearning),
    boundaryClarity:
      100 *
      (0.34 * responseInhibition +
        0.22 * riskRewardLearning +
        0.16 * cognitiveFlexibility +
        0.16 * attentionControl +
        0.12 * generativity),
    socialLearningOrientation:
      100 *
      (0.3 * feedbackLearning +
        0.2 * cognitiveFlexibility +
        0.18 * workingMemory +
        0.16 * generativity +
        0.16 * attentionControl),
  };

  return TRAIT_KEYS.map((key) => ({
    key,
    label: TRAIT_LABELS[key],
    score: round(clamp(rawScores[key])),
    explanation: traitExplanation(key),
    evidence: traitEvidence(key, {
      balloon,
      choice,
      trail,
      spatial,
      pattern,
      design,
      auditory,
    }),
  }));
}

function traitExplanation(key: TraitKey) {
  const explanations: Record<TraitKey, string> = {
    attunement:
      "Estimated from auditory signal detection, visual pattern matching, choice accuracy, and spatial attention.",
    emotionalCalibration:
      "Estimated from balancing exploration with restraint, error control, and stable choices under uncertainty.",
    responseFlexibility:
      "Estimated from trail sequencing, design novelty, balanced response speed, and adaptation after feedback.",
    patienceUnderAmbiguity:
      "Estimated from no-signal restraint, steady reaction timing, risk discipline, and holding spatial context.",
    boundaryClarity:
      "Estimated from false-alarm control, risk discipline, low repetition, and accurate stopping/error control.",
    socialLearningOrientation:
      "Estimated from completion, memory span, design novelty, trail efficiency, and behavioral adjustment after feedback.",
  };

  return explanations[key];
}

function traitEvidence(
  key: TraitKey,
  scores: {
    balloon: TaskScore;
    choice: TaskScore;
    trail: TaskScore;
    spatial: TaskScore;
    pattern: TaskScore;
    design: TaskScore;
    auditory: TaskScore;
  },
) {
  const { auditory, balloon, choice, design, pattern, spatial, trail } = scores;
  const evidence: Record<TraitKey, string[]> = {
    attunement: [
      `Auditory hit rate: ${auditory.metrics.hitRate}%`,
      `Pattern Match accuracy: ${pattern.metrics.accuracy}%`,
      `Choice Dots accuracy: ${choice.metrics.accuracy}%`,
      `Spatial Span accuracy: ${spatial.metrics.accuracy}%`,
    ],
    emotionalCalibration: [
      `Optimal exploration: ${balloon.metrics.optimalExploration}%`,
      `Balloon burst rate: ${balloon.metrics.burstRate}%`,
      `Choice Dots error rate: ${choice.metrics.errorRate}%`,
      `Trail Path error control: ${trail.metrics.errorControl}%`,
    ],
    responseFlexibility: [
      `Trail Path speed balance: ${trail.metrics.speedBalance}%`,
      `Trail Path error control: ${trail.metrics.errorControl}%`,
      `Design Grid unique rate: ${design.metrics.uniqueRate}%`,
      `Learning after pop: ${balloon.metrics.learningAfterPop}%`,
    ],
    patienceUnderAmbiguity: [
      `Median hit response: ${auditory.metrics.medianHitResponseMs} ms`,
      `Response consistency: ${auditory.metrics.responseConsistency}%`,
      `No-signal restraint: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `Spatial memory span: ${spatial.metrics.memorySpan}%`,
    ],
    boundaryClarity: [
      `False-alarm control: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `Balloon risk discipline: ${balloon.metrics.riskDiscipline}%`,
      `Design Grid repeat rate: ${design.metrics.repeatRate}%`,
      `Choice Dots error rate: ${choice.metrics.errorRate}%`,
    ],
    socialLearningOrientation: [
      `Balloon completion: ${balloon.metrics.completion}%`,
      `Spatial memory span: ${spatial.metrics.memorySpan}%`,
      `Design Grid unique rate: ${design.metrics.uniqueRate}%`,
      `Learning after pop: ${balloon.metrics.learningAfterPop}%`,
    ],
  };

  return evidence[key];
}

function matchProfiles(traitScores: TraitScore[]): ProfileMatch[] {
  const scoreMap = Object.fromEntries(
    traitScores.map((trait) => [trait.key, trait.score]),
  ) as Record<TraitKey, number>;

  return RELATIONAL_STYLE_PROFILES.map((profile) => {
    const distances = TRAIT_KEYS.map((key) =>
      Math.abs(scoreMap[key] - profile.targets[key]),
    );
    const averageDistance = mean(distances);
    const fit = clamp(100 - averageDistance);
    const gaps = TRAIT_KEYS.filter(
      (key) => profile.targets[key] - scoreMap[key] > 12,
    ).map(
      (key) =>
        `${TRAIT_LABELS[key]} is ${round(profile.targets[key] - scoreMap[key])} points below this profile target.`,
    );

    return {
      profileId: profile.id,
      label: profile.label,
      fit: round(fit),
      summary: profile.summary,
      gaps,
    };
  }).sort((a, b) => b.fit - a.fit);
}

export function computeScoreReport(
  session: CandidateSession,
  events: TelemetryEvent[],
): ScoreReport {
  const sessionEvents = events.filter((event) => event.sessionId === session.id);
  const taskScores = [
    scoreBalloonPop(sessionEvents),
    scoreChoiceDots(sessionEvents),
    scoreTrailPath(sessionEvents),
    scoreSpatialSpan(sessionEvents),
    scorePatternMatch(sessionEvents),
    scoreDesignGrid(sessionEvents),
    scoreAuditoryScreen(sessionEvents),
  ];
  const constructScores = buildConstructScores(taskScores);
  const traitScores = buildTraitScores(taskScores, constructScores);
  const profileMatches = matchProfiles(traitScores);
  const topMatch = profileMatches[0];

  return {
    sessionId: session.id,
    candidateName: session.candidateName,
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    taskScores,
    constructScores,
    traitScores,
    profileMatches,
    overallNarrative: `${session.candidateName} was assigned by the scoring system to the ${topMatch.label} style as the closest current match (${topMatch.fit}% fit). This MVP report is descriptive and should be interpreted alongside interviews, consented context, and other relationship-relevant evidence.`,
    caveats: [
      "This is an MVP behavioral signal, not a clinical diagnosis or a deterministic hiring recommendation.",
      "Scores should be monitored for group-level drift before being used in consequential decisions.",
      "Auditory results can be affected by device volume, hearing context, and browser audio settings.",
      "Balloon Pop reflects risk-reward behavior in a mini-game and should not be overgeneralized without validation.",
      "The added non-word mini-games are original browser tasks inspired by cognitive constructs, not clinical neuropsychological instruments.",
      "This model is designed to be Pymetrics-like in architecture only; it does not copy proprietary Pymetrics games, scoring weights, traits, or outputs.",
    ],
  };
}
