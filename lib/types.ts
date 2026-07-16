export type ISODateString = string;

export type TaskId =
  | "balloon-pop"
  | "choice-dots"
  | "trail-path"
  | "spatial-span"
  | "pattern-match"
  | "design-grid"
  | "auditory-screen";

export type TelemetryEventType =
  | "session_created"
  | "task_started"
  | "balloon_pump"
  | "balloon_round_completed"
  | "choice_trial_completed"
  | "trail_completed"
  | "spatial_trial_completed"
  | "pattern_trial_completed"
  | "design_round_completed"
  | "auditory_trial_started"
  | "auditory_response"
  | "task_completed"
  | "session_completed";

export type CandidateDemographics = {
  consentToFairnessMonitoring: boolean;
  ageBand?: "18-24" | "25-34" | "35-44" | "45-54" | "55+" | "prefer-not";
  hearingContext?: "quiet" | "shared-space" | "headphones" | "unknown";
};

export type CandidateSession = {
  id: string;
  candidateName: string;
  status: "in-progress" | "completed";
  createdAt: ISODateString;
  completedAt?: ISODateString;
  demographics: CandidateDemographics;
};

export type TelemetryEvent = {
  id: string;
  sessionId: string;
  taskId?: TaskId;
  eventType: TelemetryEventType;
  clientTime?: ISODateString;
  serverTime: ISODateString;
  payload: Record<string, unknown>;
};

export type TraitKey =
  | "attunement"
  | "emotionalCalibration"
  | "responseFlexibility"
  | "patienceUnderAmbiguity"
  | "boundaryClarity"
  | "socialLearningOrientation";

export type CognitiveConstructKey =
  | "riskRewardLearning"
  | "attentionControl"
  | "processingSpeed"
  | "responseInhibition"
  | "cognitiveFlexibility"
  | "workingMemory"
  | "perceptualDiscrimination"
  | "generativity"
  | "feedbackLearning";

export type TraitScore = {
  key: TraitKey;
  label: string;
  score: number;
  explanation: string;
  evidence: string[];
};

export type ConstructScore = {
  key: CognitiveConstructKey;
  label: string;
  score: number;
  explanation: string;
  evidence: string[];
  sourceTasks: TaskId[];
};

export type TaskScore = {
  taskId: TaskId;
  label: string;
  metrics: Record<string, number>;
  explanation: string;
};

export type ProfileMatch = {
  profileId: string;
  label: string;
  fit: number;
  summary: string;
  gaps: string[];
};

export type ScoreReport = {
  sessionId: string;
  candidateName: string;
  generatedAt: ISODateString;
  modelVersion: string;
  taskScores: TaskScore[];
  constructScores: ConstructScore[];
  traitScores: TraitScore[];
  profileMatches: ProfileMatch[];
  overallNarrative: string;
  caveats: string[];
};

export type AuditLogEntry = {
  id: string;
  actor: "candidate" | "developer" | "system";
  action: string;
  entityId: string;
  createdAt: ISODateString;
  metadata: Record<string, unknown>;
};

export type DataStore = {
  sessions: CandidateSession[];
  telemetry: TelemetryEvent[];
  reports: ScoreReport[];
  auditLog: AuditLogEntry[];
};

export type FairnessGroupMetric = {
  group: string;
  count: number;
  averageTraits: Record<TraitKey, number>;
};

export type FairnessOverview = {
  eligibleSessions: number;
  monitoredAttribute: "ageBand" | "hearingContext";
  groups: FairnessGroupMetric[];
  largestObservedGap: number;
  notes: string[];
};
