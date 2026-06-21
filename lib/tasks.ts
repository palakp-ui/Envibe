import type { RoleConfig, TaskId, TraitKey } from "@/lib/types";

export type AsrOption = {
  id: string;
  label: string;
  relationalCue: string;
};

export type AsrTrial = {
  id: string;
  prompt: string;
  context: string;
  options: AsrOption[];
  consensusOptionId: string;
  learningSignal: string;
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
    id: "asr-calibration",
    label: "ASR Calibration",
    cognitiveBasis:
      "Confidence calibration and affective signal recognition under mild ambiguity.",
    relationalSignal:
      "How accurately and humbly a person interprets relational cues before reacting.",
    instructions: [
      "Read each short interaction.",
      "Select the relational cue you think is most likely.",
      "Set your confidence level before submitting.",
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

export const ASR_TRIALS: AsrTrial[] = [
  {
    id: "asr-1",
    context: "A project partner replies after a tense meeting.",
    prompt:
      '"I can take another pass at the notes if that helps. I just want us to be aligned before we send them."',
    options: [
      {
        id: "repair",
        label: "Repair attempt",
        relationalCue: "They are trying to reduce friction and restore shared ground.",
      },
      {
        id: "withdrawal",
        label: "Withdrawal",
        relationalCue: "They are distancing themselves from the collaboration.",
      },
      {
        id: "dominance",
        label: "Control bid",
        relationalCue: "They are trying to take over the decision.",
      },
    ],
    consensusOptionId: "repair",
    learningSignal:
      "The statement offers help and names alignment, which usually signals repair rather than control.",
  },
  {
    id: "asr-2",
    context: "A friend responds to a last-minute change of plans.",
    prompt:
      '"Okay. I wish I had known earlier, but I understand things came up."',
    options: [
      {
        id: "boundary",
        label: "Boundary with continued connection",
        relationalCue:
          "They are naming an impact while preserving goodwill.",
      },
      {
        id: "rejection",
        label: "Rejection",
        relationalCue: "They are ending the relationship or withdrawing care.",
      },
      {
        id: "approval",
        label: "Unqualified approval",
        relationalCue: "They have no unmet need or concern.",
      },
    ],
    consensusOptionId: "boundary",
    learningSignal:
      "The phrase combines impact language with understanding, a common cue for a connected boundary.",
  },
  {
    id: "asr-3",
    context: "A teammate sees a mistake in a shared document.",
    prompt:
      '"Can we slow down for a second and check this section together? I may be missing something."',
    options: [
      {
        id: "collaborative-check",
        label: "Collaborative check",
        relationalCue: "They are inviting joint attention without assigning blame.",
      },
      {
        id: "avoidance",
        label: "Avoidance",
        relationalCue: "They are avoiding accountability for a problem.",
      },
      {
        id: "criticism",
        label: "Personal criticism",
        relationalCue: "They are implying incompetence.",
      },
    ],
    consensusOptionId: "collaborative-check",
    learningSignal:
      "Joint language and uncertainty markers point toward collaboration, not personal criticism.",
  },
  {
    id: "asr-4",
    context: "A new colleague asks about your preferred workflow.",
    prompt:
      '"Do you like quick check-ins, or would you rather I collect questions and send one message later?"',
    options: [
      {
        id: "adaptation",
        label: "Adaptive preference seeking",
        relationalCue: "They are trying to match communication to your needs.",
      },
      {
        id: "surveillance",
        label: "Surveillance",
        relationalCue: "They are monitoring your work too closely.",
      },
      {
        id: "indifference",
        label: "Indifference",
        relationalCue: "They are disengaged from collaboration quality.",
      },
    ],
    consensusOptionId: "adaptation",
    learningSignal:
      "Offering options and asking for preference is a cue for adaptive coordination.",
  },
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

export const ROLE_CONFIGS: RoleConfig[] = [
  {
    id: "relationship-coach",
    label: "Relationship coach",
    description:
      "High-touch role emphasizing accurate cue reading, repair, and calm pacing.",
    traitWeights: {
      attunement: 0.22,
      emotionalCalibration: 0.24,
      responseFlexibility: 0.16,
      patienceUnderAmbiguity: 0.18,
      boundaryClarity: 0.08,
      socialLearningOrientation: 0.12,
    },
  },
  {
    id: "community-manager",
    label: "Community manager",
    description:
      "Group-facing role balancing listening, boundary setting, and adaptive response.",
    traitWeights: {
      attunement: 0.2,
      emotionalCalibration: 0.16,
      responseFlexibility: 0.18,
      patienceUnderAmbiguity: 0.12,
      boundaryClarity: 0.18,
      socialLearningOrientation: 0.16,
    },
  },
  {
    id: "care-coordinator",
    label: "Care coordinator",
    description:
      "Support role where sustained attention, restraint, and clear communication matter.",
    traitWeights: {
      attunement: 0.18,
      emotionalCalibration: 0.18,
      responseFlexibility: 0.14,
      patienceUnderAmbiguity: 0.18,
      boundaryClarity: 0.16,
      socialLearningOrientation: 0.16,
    },
  },
];

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
