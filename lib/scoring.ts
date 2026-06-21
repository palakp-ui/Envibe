import {
  ASR_TRIALS,
  AUDITORY_TRIALS,
  RELATIONAL_STYLE_PROFILES,
  TRAIT_LABELS,
} from "@/lib/tasks";
import type {
  CandidateSession,
  ProfileMatch,
  ScoreReport,
  TaskScore,
  TelemetryEvent,
  TraitKey,
  TraitScore,
} from "@/lib/types";

const TRAIT_KEYS = Object.keys(TRAIT_LABELS) as TraitKey[];

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

function scoreAsrCalibration(events: TelemetryEvent[]): TaskScore {
  const responses = events.filter((event) => event.eventType === "asr_response");
  const totalTrials = ASR_TRIALS.length;
  const correctness = responses.map((event) =>
    asBoolean(event.payload.correct) ? 1 : 0,
  );
  const confidences = responses.map((event) =>
    clamp(asNumber(event.payload.confidence), 0, 100),
  );
  const responseTimes = responses.map((event) =>
    asNumber(event.payload.responseMs),
  );
  const calibrationErrors = responses.map((event) => {
    const expectedConfidence = asBoolean(event.payload.correct) ? 100 : 0;
    return Math.abs(expectedConfidence - clamp(asNumber(event.payload.confidence), 0, 100));
  });

  const accuracy = mean(correctness);
  const completion = totalTrials === 0 ? 0 : responses.length / totalTrials;
  const calibrationError = mean(calibrationErrors) / 100;
  const confidence = mean(confidences) / 100;
  const medianResponseMs = median(responseTimes);

  return {
    taskId: "asr-calibration",
    label: "ASR Calibration",
    metrics: {
      accuracy: round(accuracy * 100),
      completion: round(completion * 100),
      averageConfidence: round(confidence * 100),
      calibrationError: round(calibrationError * 100),
      medianResponseMs: round(medianResponseMs, 0),
    },
    explanation:
      "Compares consensus cue identification with stated confidence to estimate calibrated interpretation under relational ambiguity.",
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

function metric(taskScore: TaskScore, key: string) {
  return asNumber(taskScore.metrics[key]) / 100;
}

function buildTraitScores(asr: TaskScore, auditory: TaskScore): TraitScore[] {
  const asrAccuracy = metric(asr, "accuracy");
  const asrCompletion = metric(asr, "completion");
  const confidence = metric(asr, "averageConfidence");
  const calibrationQuality = 1 - metric(asr, "calibrationError");
  const hitRate = metric(auditory, "hitRate");
  const falseAlarmControl = 1 - metric(auditory, "falseAlarmRate");
  const auditoryCompletion = metric(auditory, "completion");
  const consistency = metric(auditory, "responseConsistency");
  const rtMs = asNumber(auditory.metrics.medianHitResponseMs);
  const speedBalance = rtMs
    ? clamp(1 - Math.abs(rtMs - 650) / 900, 0, 1)
    : 0.45;
  const completion = mean([asrCompletion, auditoryCompletion]);

  const rawScores: Record<TraitKey, number> = {
    attunement:
      100 *
      (0.4 * hitRate +
        0.24 * falseAlarmControl +
        0.24 * asrAccuracy +
        0.12 * consistency),
    emotionalCalibration:
      100 * (0.45 * asrAccuracy + 0.45 * calibrationQuality + 0.1 * confidence),
    responseFlexibility:
      100 *
      (0.32 * speedBalance +
        0.26 * consistency +
        0.22 * asrAccuracy +
        0.2 * completion),
    patienceUnderAmbiguity:
      100 *
      (0.38 * falseAlarmControl +
        0.28 * calibrationQuality +
        0.18 * consistency +
        0.16 * completion),
    boundaryClarity:
      100 *
      (0.42 * falseAlarmControl +
        0.24 * calibrationQuality +
        0.2 * asrAccuracy +
        0.14 * (1 - Math.max(confidence - asrAccuracy, 0))),
    socialLearningOrientation:
      100 *
      (0.34 * completion +
        0.26 * calibrationQuality +
        0.22 * consistency +
        0.18 * asrAccuracy),
  };

  return TRAIT_KEYS.map((key) => ({
    key,
    label: TRAIT_LABELS[key],
    score: round(clamp(rawScores[key])),
    explanation: traitExplanation(key),
    evidence: traitEvidence(key, asr, auditory),
  }));
}

function traitExplanation(key: TraitKey) {
  const explanations: Record<TraitKey, string> = {
    attunement:
      "Estimated from accurate signal detection, restrained false alarms, and relational cue reading.",
    emotionalCalibration:
      "Estimated from matching confidence to correctness when interpreting ambiguous relational statements.",
    responseFlexibility:
      "Estimated from balanced response speed, response consistency, completion, and cue adaptation.",
    patienceUnderAmbiguity:
      "Estimated from waiting through no-signal auditory trials and avoiding overconfident interpretations.",
    boundaryClarity:
      "Estimated from false-alarm control, calibrated certainty, and accurate recognition of connected boundaries.",
    socialLearningOrientation:
      "Estimated from completion, consistency, and responsiveness to calibration feedback.",
  };

  return explanations[key];
}

function traitEvidence(
  key: TraitKey,
  asr: TaskScore,
  auditory: TaskScore,
) {
  const evidence: Record<TraitKey, string[]> = {
    attunement: [
      `Auditory hit rate: ${auditory.metrics.hitRate}%`,
      `Auditory false-alarm rate: ${auditory.metrics.falseAlarmRate}%`,
      `ASR cue accuracy: ${asr.metrics.accuracy}%`,
    ],
    emotionalCalibration: [
      `ASR calibration error: ${asr.metrics.calibrationError}%`,
      `ASR average confidence: ${asr.metrics.averageConfidence}%`,
      `ASR cue accuracy: ${asr.metrics.accuracy}%`,
    ],
    responseFlexibility: [
      `Median hit response: ${auditory.metrics.medianHitResponseMs} ms`,
      `Response consistency: ${auditory.metrics.responseConsistency}%`,
      `Assessment completion: ${round(mean([metric(asr, "completion"), metric(auditory, "completion")]) * 100)}%`,
    ],
    patienceUnderAmbiguity: [
      `No-signal restraint: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `ASR calibration quality: ${round(100 - asNumber(asr.metrics.calibrationError))}%`,
      `Auditory consistency: ${auditory.metrics.responseConsistency}%`,
    ],
    boundaryClarity: [
      `False-alarm control: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `Connected-boundary cue coverage appears in the ASR item set.`,
      `Confidence-over-accuracy balance: ${asr.metrics.averageConfidence}% confidence / ${asr.metrics.accuracy}% accuracy`,
    ],
    socialLearningOrientation: [
      `ASR completion: ${asr.metrics.completion}%`,
      `Auditory completion: ${auditory.metrics.completion}%`,
      `Calibration quality: ${round(100 - asNumber(asr.metrics.calibrationError))}%`,
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
    scoreAsrCalibration(sessionEvents),
    scoreAuditoryScreen(sessionEvents),
  ];
  const traitScores = buildTraitScores(taskScores[0], taskScores[1]);
  const profileMatches = matchProfiles(traitScores);
  const topMatch = profileMatches[0];

  return {
    sessionId: session.id,
    candidateName: session.candidateName,
    generatedAt: new Date().toISOString(),
    taskScores,
    traitScores,
    profileMatches,
    overallNarrative: `${session.candidateName} currently maps most closely to the ${topMatch.label} style (${topMatch.fit}% fit). This MVP report is descriptive and should be interpreted alongside interviews, consented context, and role-relevant evidence.`,
    caveats: [
      "This is an MVP behavioral signal, not a clinical diagnosis or a deterministic hiring recommendation.",
      "Scores should be monitored for group-level drift before being used in consequential decisions.",
      "Auditory results can be affected by device volume, hearing context, and browser audio settings.",
    ],
  };
}
