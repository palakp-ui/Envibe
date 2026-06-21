export type ISODateString = string;

export type TaskId = "asr-calibration" | "auditory-screen";

export type TelemetryEventType =
  | "session_created"
  | "task_started"
  | "asr_response"
  | "auditory_trial_started"
  | "auditory_response"
  | "task_completed"
  | "session_completed";

export type CandidateDemographics = {
  consentToFairnessMonitoring: boolean;
  ageBand?: "18-24" | "25-34" | "35-44" | "45-54" | "55+" | "prefer-not";
  language?: string;
  hearingContext?: "quiet" | "shared-space" | "headphones" | "unknown";
};

export type CandidateSession = {
  id: string;
  candidateName: string;
  targetRoleId: string;
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

export type TraitScore = {
  key: TraitKey;
  label: string;
  score: number;
  explanation: string;
  evidence: string[];
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
  taskScores: TaskScore[];
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

export type RoleConfig = {
  id: string;
  label: string;
  description: string;
  traitWeights: Record<TraitKey, number>;
};

export type DataStore = {
  sessions: CandidateSession[];
  telemetry: TelemetryEvent[];
  reports: ScoreReport[];
  auditLog: AuditLogEntry[];
  roleConfigs: RoleConfig[];
};

export type FairnessGroupMetric = {
  group: string;
  count: number;
  averageTraits: Record<TraitKey, number>;
};

export type FairnessOverview = {
  eligibleSessions: number;
  monitoredAttribute: "ageBand" | "language" | "hearingContext";
  groups: FairnessGroupMetric[];
  largestObservedGap: number;
  notes: string[];
};
