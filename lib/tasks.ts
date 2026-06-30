import type { TaskId, TraitKey } from "@/lib/types";

export type BalloonRound = {
  id: string;
  burstAt: number;
  maxPumps: number;
  rewardPerPump: number;
};

export type AuditoryTrial = {
  id: string;
  signalPresent: boolean;
  frequencyHz: number;
  delayMs: number;
};

export type AssessmentTask = {
  id: TaskId;
  label: string;
  cognitiveBasis: string;
  relationalSignal: string;
  instructions: string[];
};

export const TASKS: AssessmentTask[] = [
  {
    id: "balloon-pop",
    label: "Balloon Pop",
    cognitiveBasis:
      "Risk-reward learning, inhibitory control, reward sensitivity, and adaptation after loss.",
    relationalSignal:
      "How a person balances initiative, restraint, and learning from feedback in uncertain situations.",
    instructions: [
      "Pump the balloon to grow its value.",
      "Bank before it pops to keep the points.",
      "Each balloon has a different hidden pop point.",
    ],
  },
  {
    id: "auditory-screen",
    label: "Auditory Screen",
    cognitiveBasis:
      "Basic auditory detection, sustained attention, response speed, and false-alarm control.",
    relationalSignal:
      "Listening attunement and restraint before responding when signals are uncertain.",
    instructions: [
      "Turn on sound and use headphones if available.",
      "Press the detection button only when you hear the target tone.",
      "Some trials contain no tone, so waiting is sometimes the best response.",
    ],
  },
];

export const BALLOON_ROUNDS: BalloonRound[] = [
  { id: "balloon-1", burstAt: 7, maxPumps: 12, rewardPerPump: 4 },
  { id: "balloon-2", burstAt: 10, maxPumps: 12, rewardPerPump: 4 },
  { id: "balloon-3", burstAt: 5, maxPumps: 12, rewardPerPump: 5 },
  { id: "balloon-4", burstAt: 11, maxPumps: 12, rewardPerPump: 4 },
  { id: "balloon-5", burstAt: 8, maxPumps: 12, rewardPerPump: 5 },
  { id: "balloon-6", burstAt: 6, maxPumps: 12, rewardPerPump: 6 },
];

export const AUDITORY_TRIALS: AuditoryTrial[] = [
  { id: "aud-1", signalPresent: true, frequencyHz: 660, delayMs: 850 },
  { id: "aud-2", signalPresent: false, frequencyHz: 660, delayMs: 1100 },
  { id: "aud-3", signalPresent: true, frequencyHz: 660, delayMs: 1250 },
  { id: "aud-4", signalPresent: true, frequencyHz: 660, delayMs: 720 },
  { id: "aud-5", signalPresent: false, frequencyHz: 660, delayMs: 1400 },
  { id: "aud-6", signalPresent: true, frequencyHz: 660, delayMs: 980 },
  { id: "aud-7", signalPresent: false, frequencyHz: 660, delayMs: 900 },
  { id: "aud-8", signalPresent: true, frequencyHz: 660, delayMs: 1150 },
];

export const TRAIT_LABELS: Record<TraitKey, string> = {
  attunement: "Relational attunement",
  emotionalCalibration: "Emotional calibration",
  responseFlexibility: "Response flexibility",
  patienceUnderAmbiguity: "Patience under ambiguity",
  boundaryClarity: "Boundary clarity",
  socialLearningOrientation: "Social learning orientation",
};

export const RELATIONAL_STYLE_PROFILES = [
  {
    id: "secure-collaborator",
    label: "Secure collaborator",
    summary:
      "Balances warmth with clear interpretation, steady listening, and repair-oriented pacing.",
    targets: {
      attunement: 82,
      emotionalCalibration: 84,
      responseFlexibility: 76,
      patienceUnderAmbiguity: 78,
      boundaryClarity: 72,
      socialLearningOrientation: 80,
    },
  },
  {
    id: "empathic-harmonizer",
    label: "Empathic harmonizer",
    summary:
      "Highly responsive to relational signals and motivated to maintain connection.",
    targets: {
      attunement: 88,
      emotionalCalibration: 78,
      responseFlexibility: 74,
      patienceUnderAmbiguity: 70,
      boundaryClarity: 62,
      socialLearningOrientation: 82,
    },
  },
  {
    id: "analytical-boundary-setter",
    label: "Analytical boundary setter",
    summary:
      "Deliberate, restrained, and clear about limits while preserving collaborative intent.",
    targets: {
      attunement: 70,
      emotionalCalibration: 76,
      responseFlexibility: 68,
      patienceUnderAmbiguity: 84,
      boundaryClarity: 86,
      socialLearningOrientation: 68,
    },
  },
  {
    id: "adaptive-explorer",
    label: "Adaptive explorer",
    summary:
      "Learns quickly from feedback and adjusts interaction style across contexts.",
    targets: {
      attunement: 74,
      emotionalCalibration: 72,
      responseFlexibility: 86,
      patienceUnderAmbiguity: 72,
      boundaryClarity: 70,
      socialLearningOrientation: 88,
    },
  },
];
