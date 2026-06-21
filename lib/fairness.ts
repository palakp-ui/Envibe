import { TRAIT_LABELS } from "@/lib/tasks";
import type {
  CandidateSession,
  FairnessGroupMetric,
  FairnessOverview,
  ScoreReport,
  TraitKey,
} from "@/lib/types";

const TRAIT_KEYS = Object.keys(TRAIT_LABELS) as TraitKey[];

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeFairnessOverview(
  sessions: CandidateSession[],
  reports: ScoreReport[],
  monitoredAttribute: FairnessOverview["monitoredAttribute"] = "hearingContext",
): FairnessOverview {
  const reportBySession = new Map(
    reports.map((report) => [report.sessionId, report]),
  );
  const eligible = sessions.filter(
    (session) =>
      session.demographics.consentToFairnessMonitoring &&
      reportBySession.has(session.id),
  );
  const grouped = new Map<string, ScoreReport[]>();

  for (const session of eligible) {
    const key = session.demographics[monitoredAttribute] || "unknown";
    const report = reportBySession.get(session.id);

    if (!report) {
      continue;
    }

    grouped.set(key, [...(grouped.get(key) || []), report]);
  }

  const groups: FairnessGroupMetric[] = [...grouped.entries()].map(
    ([group, groupReports]) => ({
      group,
      count: groupReports.length,
      averageTraits: Object.fromEntries(
        TRAIT_KEYS.map((traitKey) => [
          traitKey,
          round(
            average(
              groupReports.map(
                (report) =>
                  report.traitScores.find((trait) => trait.key === traitKey)
                    ?.score || 0,
              ),
            ),
          ),
        ]),
      ) as FairnessGroupMetric["averageTraits"],
    }),
  );

  const largestObservedGap = TRAIT_KEYS.reduce((largestGap, traitKey) => {
    const traitAverages = groups.map((group) => group.averageTraits[traitKey]);

    if (traitAverages.length <= 1) {
      return largestGap;
    }

    const gap = Math.max(...traitAverages) - Math.min(...traitAverages);

    return Math.max(largestGap, gap);
  }, 0);

  return {
    eligibleSessions: eligible.length,
    monitoredAttribute,
    groups,
    largestObservedGap: round(largestObservedGap),
    notes: [
      "This hook reports descriptive differences only; it does not adjust, suppress, or recommend candidate outcomes.",
      "Small group counts should be treated as unstable and reviewed qualitatively.",
      "Additional protected-class governance is required before using scores in consequential workflows.",
    ],
  };
}
