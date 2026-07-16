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

export type ChoiceDotTrial = {
  id: string;
  targetSide: "left" | "right";
  delayMs: number;
};

export type TrailNode = {
  id: number;
  x: number;
  y: number;
};

export type SpatialSpanTrial = {
  id: string;
  sequence: number[];
};

export type PatternMatchTrial = {
  id: string;
  targetIndex: number;
  tiles: Array<{
    shape: "circle" | "square" | "diamond";
    color: string;
    rotate?: number;
  }>;
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
    id: "choice-dots",
    label: "Choice Dots",
    cognitiveBasis:
      "Choice reaction time, visual attention, lateralized responding, and error control.",
    relationalSignal:
      "How quickly and accurately a person responds when the right action depends on context.",
    instructions: [
      "Wait for the dot to appear.",
      "Tap the matching side.",
      "Accuracy matters more than guessing early.",
    ],
  },
  {
    id: "trail-path",
    label: "Trail Path",
    cognitiveBasis:
      "Visual sequencing, planning, cognitive flexibility, and error monitoring.",
    relationalSignal:
      "How directly a person moves through a changing situation while recovering from missteps.",
    instructions: [
      "Tap the circles in order.",
      "Wrong taps count as errors.",
      "Complete the path as directly as you can.",
    ],
  },
  {
    id: "spatial-span",
    label: "Spatial Span",
    cognitiveBasis:
      "Visuospatial working memory, sequence retention, and attentional control.",
    relationalSignal:
      "How much interaction context a person can hold before responding.",
    instructions: [
      "Watch the highlighted squares.",
      "Repeat the pattern in the same order.",
      "Sequences get longer across rounds.",
    ],
  },
  {
    id: "pattern-match",
    label: "Pattern Match",
    cognitiveBasis:
      "Visual search, perceptual discrimination, sustained attention, and careful responding.",
    relationalSignal:
      "How accurately a person detects relevant signals amid similar distractors.",
    instructions: [
      "Find the tile that matches the target.",
      "Tap one tile per round.",
      "Balance speed with accuracy.",
    ],
  },
  {
    id: "design-grid",
    label: "Design Grid",
    cognitiveBasis:
      "Design fluency, novelty generation, repetition inhibition, and planning.",
    relationalSignal:
      "How flexibly a person generates new approaches without repeating stale patterns.",
    instructions: [
      "Create a four-dot pattern.",
      "Try not to repeat earlier patterns.",
      "Each round should be a new design.",
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

export const CHOICE_DOT_TRIALS: ChoiceDotTrial[] = [
  { id: "choice-1", targetSide: "left", delayMs: 650 },
  { id: "choice-2", targetSide: "right", delayMs: 820 },
  { id: "choice-3", targetSide: "right", delayMs: 560 },
  { id: "choice-4", targetSide: "left", delayMs: 940 },
  { id: "choice-5", targetSide: "right", delayMs: 700 },
  { id: "choice-6", targetSide: "left", delayMs: 880 },
];

export const TRAIL_NODES: TrailNode[] = [
  { id: 1, x: 14, y: 22 },
  { id: 2, x: 72, y: 14 },
  { id: 3, x: 58, y: 46 },
  { id: 4, x: 24, y: 54 },
  { id: 5, x: 38, y: 80 },
  { id: 6, x: 84, y: 72 },
  { id: 7, x: 68, y: 88 },
  { id: 8, x: 16, y: 76 },
];

export const SPATIAL_SPAN_TRIALS: SpatialSpanTrial[] = [
  { id: "span-1", sequence: [0, 4, 2] },
  { id: "span-2", sequence: [6, 3, 8, 1] },
  { id: "span-3", sequence: [2, 5, 0, 7, 4] },
  { id: "span-4", sequence: [8, 1, 6, 3, 0, 5] },
];

export const PATTERN_MATCH_TRIALS: PatternMatchTrial[] = [
  {
    id: "pattern-1",
    targetIndex: 5,
    tiles: [
      { shape: "circle", color: "#2d6cdf" },
      { shape: "square", color: "#2f7d5c" },
      { shape: "diamond", color: "#ae6b16" },
      { shape: "circle", color: "#b4495b" },
      { shape: "square", color: "#2d6cdf" },
      { shape: "diamond", color: "#2d6cdf" },
      { shape: "diamond", color: "#2f7d5c" },
      { shape: "circle", color: "#ae6b16" },
      { shape: "square", color: "#b4495b" },
    ],
  },
  {
    id: "pattern-2",
    targetIndex: 1,
    tiles: [
      { shape: "square", color: "#2f7d5c" },
      { shape: "circle", color: "#2f7d5c" },
      { shape: "diamond", color: "#2f7d5c" },
      { shape: "circle", color: "#2d6cdf" },
      { shape: "square", color: "#ae6b16" },
      { shape: "diamond", color: "#b4495b" },
      { shape: "circle", color: "#ae6b16" },
      { shape: "square", color: "#2d6cdf" },
      { shape: "diamond", color: "#2d6cdf" },
    ],
  },
  {
    id: "pattern-3",
    targetIndex: 7,
    tiles: [
      { shape: "diamond", color: "#b4495b" },
      { shape: "circle", color: "#b4495b" },
      { shape: "square", color: "#2f7d5c" },
      { shape: "diamond", color: "#2f7d5c" },
      { shape: "circle", color: "#2d6cdf" },
      { shape: "square", color: "#ae6b16" },
      { shape: "circle", color: "#ae6b16" },
      { shape: "square", color: "#b4495b" },
      { shape: "diamond", color: "#2d6cdf" },
    ],
  },
];

export const DESIGN_GRID_ROUNDS = 4;

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
