import {
  AUDITORY_TRIALS,
  BALLOON_ROUNDS,
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

function metric(taskScore: TaskScore, key: string) {
  return asNumber(taskScore.metrics[key]) / 100;
}

function buildTraitScores(balloon: TaskScore, auditory: TaskScore): TraitScore[] {
  const balloonCompletion = metric(balloon, "completion");
  const riskDiscipline = metric(balloon, "riskDiscipline");
  const optimalExploration = metric(balloon, "optimalExploration");
  const learningAfterPop = metric(balloon, "learningAfterPop");
  const pumpConsistency = metric(balloon, "pumpConsistency");
  const hitRate = metric(auditory, "hitRate");
  const falseAlarmControl = 1 - metric(auditory, "falseAlarmRate");
  const auditoryCompletion = metric(auditory, "completion");
  const consistency = metric(auditory, "responseConsistency");
  const rtMs = asNumber(auditory.metrics.medianHitResponseMs);
  const speedBalance = rtMs
    ? clamp(1 - Math.abs(rtMs - 650) / 900, 0, 1)
    : 0.45;
  const completion = mean([balloonCompletion, auditoryCompletion]);

  const rawScores: Record<TraitKey, number> = {
    attunement:
      100 *
      (0.4 * hitRate +
        0.24 * falseAlarmControl +
        0.18 * riskDiscipline +
        0.06 * learningAfterPop +
        0.12 * consistency),
    emotionalCalibration:
      100 *
      (0.36 * riskDiscipline +
        0.28 * optimalExploration +
        0.22 * pumpConsistency +
        0.14 * falseAlarmControl),
    responseFlexibility:
      100 *
      (0.32 * speedBalance +
        0.26 * consistency +
        0.22 * learningAfterPop +
        0.2 * completion),
    patienceUnderAmbiguity:
      100 *
      (0.38 * falseAlarmControl +
        0.28 * riskDiscipline +
        0.18 * consistency +
        0.16 * completion),
    boundaryClarity:
      100 *
      (0.42 * falseAlarmControl +
        0.28 * riskDiscipline +
        0.16 * optimalExploration +
        0.14 * pumpConsistency),
    socialLearningOrientation:
      100 *
      (0.34 * completion +
        0.26 * learningAfterPop +
        0.22 * consistency +
        0.18 * optimalExploration),
  };

  return TRAIT_KEYS.map((key) => ({
    key,
    label: TRAIT_LABELS[key],
    score: round(clamp(rawScores[key])),
    explanation: traitExplanation(key),
    evidence: traitEvidence(key, balloon, auditory),
  }));
}

function traitExplanation(key: TraitKey) {
  const explanations: Record<TraitKey, string> = {
    attunement:
      "Estimated from accurate signal detection, restrained false alarms, and careful risk control.",
    emotionalCalibration:
      "Estimated from balancing exploration with restraint when reward and loss are uncertain.",
    responseFlexibility:
      "Estimated from balanced response speed, response consistency, completion, and adaptation after a popped balloon.",
    patienceUnderAmbiguity:
      "Estimated from waiting through no-signal auditory trials and banking points before overextending.",
    boundaryClarity:
      "Estimated from false-alarm control, risk discipline, and consistent stopping behavior.",
    socialLearningOrientation:
      "Estimated from completion, consistency, and behavioral adjustment after feedback.",
  };

  return explanations[key];
}

function traitEvidence(
  key: TraitKey,
  balloon: TaskScore,
  auditory: TaskScore,
) {
  const evidence: Record<TraitKey, string[]> = {
    attunement: [
      `Auditory hit rate: ${auditory.metrics.hitRate}%`,
      `Auditory false-alarm rate: ${auditory.metrics.falseAlarmRate}%`,
      `Balloon risk discipline: ${balloon.metrics.riskDiscipline}%`,
    ],
    emotionalCalibration: [
      `Optimal exploration: ${balloon.metrics.optimalExploration}%`,
      `Balloon burst rate: ${balloon.metrics.burstRate}%`,
      `Pump consistency: ${balloon.metrics.pumpConsistency}%`,
    ],
    responseFlexibility: [
      `Median hit response: ${auditory.metrics.medianHitResponseMs} ms`,
      `Response consistency: ${auditory.metrics.responseConsistency}%`,
      `Learning after pop: ${balloon.metrics.learningAfterPop}%`,
    ],
    patienceUnderAmbiguity: [
      `No-signal restraint: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `Balloon risk discipline: ${balloon.metrics.riskDiscipline}%`,
      `Auditory consistency: ${auditory.metrics.responseConsistency}%`,
    ],
    boundaryClarity: [
      `False-alarm control: ${round(100 - asNumber(auditory.metrics.falseAlarmRate))}%`,
      `Adjusted average pumps on banked rounds: ${balloon.metrics.adjustedAveragePumps}`,
      `Pump consistency: ${balloon.metrics.pumpConsistency}%`,
    ],
    socialLearningOrientation: [
      `Balloon completion: ${balloon.metrics.completion}%`,
      `Auditory completion: ${auditory.metrics.completion}%`,
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
    overallNarrative: `${session.candidateName} was assigned by the scoring system to the ${topMatch.label} style as the closest current match (${topMatch.fit}% fit). This MVP report is descriptive and should be interpreted alongside interviews, consented context, and other relationship-relevant evidence.`,
    caveats: [
      "This is an MVP behavioral signal, not a clinical diagnosis or a deterministic hiring recommendation.",
      "Scores should be monitored for group-level drift before being used in consequential decisions.",
      "Auditory results can be affected by device volume, hearing context, and browser audio settings.",
      "Balloon Pop reflects risk-reward behavior in a mini-game and should not be overgeneralized without validation.",
    ],
  };
}
