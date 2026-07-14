"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUDITORY_TRIALS,
  BALLOON_ROUNDS,
  CHOICE_DOT_TRIALS,
  DESIGN_GRID_ROUNDS,
  PATTERN_MATCH_TRIALS,
  SPATIAL_SPAN_TRIALS,
  TASKS,
  TRAIL_NODES,
} from "@/lib/tasks";
import type {
  CandidateDemographics,
  CandidateSession,
  ScoreReport,
  TaskId,
  TelemetryEventType,
} from "@/lib/types";

type Stage =
  | "intake"
  | "balloon"
  | "choice"
  | "trail"
  | "spatial"
  | "pattern"
  | "design"
  | "auditory"
  | "report";

type Tile = {
  shape: "circle" | "square" | "diamond";
  color: string;
};

type TelemetryPayload = Record<string, unknown>;

const FLOW: Array<Exclude<Stage, "intake" | "report">> = [
  "balloon",
  "choice",
  "trail",
  "spatial",
  "pattern",
  "design",
  "auditory",
];

const TASK_LABEL_BY_STAGE: Record<Exclude<Stage, "intake" | "report">, string> =
  {
    balloon: "Balloon Pop",
    choice: "Choice Dots",
    trail: "Trail Path",
    spatial: "Spatial Span",
    pattern: "Pattern Match",
    design: "Design Grid",
    auditory: "Auditory Screen",
  };

const TASK_ID_BY_STAGE: Record<
  Exclude<Stage, "intake" | "report">,
  TaskId
> = {
  balloon: "balloon-pop",
  choice: "choice-dots",
  trail: "trail-path",
  spatial: "spatial-span",
  pattern: "pattern-match",
  design: "design-grid",
  auditory: "auditory-screen",
};

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error || "Request failed.");
  }

  return (await response.json()) as T;
}

function playTone(frequencyHz: number) {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = frequencyHz;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.addEventListener("ended", () => void context.close());
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function taskLabel(taskId: TaskId) {
  return TASKS.find((task) => task.id === taskId)?.label || taskId;
}

function renderPatternTile(tile: Tile, size = 54) {
  const transform =
    tile.shape === "diamond" ? "rotate(45deg)" : "rotate(0deg)";

  return (
    <span
      aria-hidden="true"
      style={{
        background: tile.color,
        borderRadius: tile.shape === "circle" ? "999px" : "12px",
        display: "inline-block",
        height: size,
        transform,
        width: size,
      }}
    />
  );
}

export function AssessmentRunner() {
  const [stage, setStage] = useState<Stage>("intake");
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [demographics, setDemographics] = useState<CandidateDemographics>({
    consentToFairnessMonitoring: false,
    ageBand: "prefer-not",
    language: "English",
    hearingContext: "unknown",
  });
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [balloonIndex, setBalloonIndex] = useState(0);
  const [balloonPumps, setBalloonPumps] = useState(0);
  const [balloonPoints, setBalloonPoints] = useState(0);
  const [totalBankedPoints, setTotalBankedPoints] = useState(0);
  const [balloonState, setBalloonState] = useState<
    "active" | "banked" | "burst"
  >("active");
  const [balloonMessage, setBalloonMessage] = useState(
    "Pump to grow the balloon, then bank before it pops.",
  );
  const [trialStartedAt, setTrialStartedAt] = useState<number>(() =>
    performance.now(),
  );
  const [auditoryIndex, setAuditoryIndex] = useState(0);
  const [auditoryState, setAuditoryState] = useState<
    "idle" | "waiting" | "responded" | "done"
  >("idle");
  const [auditoryMessage, setAuditoryMessage] = useState(
    "Start each trial, then press only when you hear the tone.",
  );
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [choiceState, setChoiceState] = useState<
    "idle" | "waiting" | "visible" | "responded"
  >("idle");
  const [choiceSide, setChoiceSide] = useState<"left" | "right" | null>(null);
  const [choiceMessage, setChoiceMessage] = useState(
    "Start the trial, then tap the side where the dot appears.",
  );
  const [trailNextTarget, setTrailNextTarget] = useState(1);
  const [trailErrors, setTrailErrors] = useState(0);
  const [trailState, setTrailState] = useState<"active" | "complete">("active");
  const [spatialIndex, setSpatialIndex] = useState(0);
  const [spatialPhase, setSpatialPhase] = useState<
    "ready" | "showing" | "input" | "feedback"
  >("ready");
  const [spatialActiveCell, setSpatialActiveCell] = useState<number | null>(null);
  const [spatialInput, setSpatialInput] = useState<number[]>([]);
  const [spatialMessage, setSpatialMessage] = useState(
    "Watch the highlighted squares, then repeat the pattern.",
  );
  const [patternIndex, setPatternIndex] = useState(0);
  const [patternState, setPatternState] = useState<"active" | "feedback">(
    "active",
  );
  const [patternMessage, setPatternMessage] = useState(
    "Find the tile that matches the target.",
  );
  const [designRound, setDesignRound] = useState(0);
  const [designCells, setDesignCells] = useState<number[]>([]);
  const [designPatterns, setDesignPatterns] = useState<string[]>([]);
  const [designSaved, setDesignSaved] = useState(false);
  const [designMessage, setDesignMessage] = useState(
    "Choose four dots to make a new pattern.",
  );
  const [report, setReport] = useState<ScoreReport | null>(null);
  const signalStartedAt = useRef<number | null>(null);
  const respondedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const toneRef = useRef<number | null>(null);
  const choiceTimeoutRef = useRef<number | null>(null);
  const stimulusStartedAt = useRef<number | null>(null);

  const currentBalloonRound = BALLOON_ROUNDS[balloonIndex];
  const currentAuditoryTrial = AUDITORY_TRIALS[auditoryIndex];
  const currentChoiceTrial = CHOICE_DOT_TRIALS[choiceIndex];
  const currentSpatialTrial = SPATIAL_SPAN_TRIALS[spatialIndex];
  const currentPatternTrial = PATTERN_MATCH_TRIALS[patternIndex];
  const progress = useMemo(() => {
    if (stage === "report") {
      return 100;
    }

    if (stage === "intake") {
      return 0;
    }

    const stageIndex = FLOW.indexOf(stage);
    return ((stageIndex + 0.2) / FLOW.length) * 100;
  }, [stage]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if (toneRef.current) {
        window.clearTimeout(toneRef.current);
      }

      if (choiceTimeoutRef.current) {
        window.clearTimeout(choiceTimeoutRef.current);
      }
    };
  }, []);

  async function recordTelemetry(
    eventType: TelemetryEventType,
    payload: TelemetryPayload,
    taskId?: TaskId,
  ) {
    if (!session) {
      return;
    }

    await postJson("/api/telemetry", {
      sessionId: session.id,
      taskId,
      eventType,
      clientTime: new Date().toISOString(),
      payload,
    });
  }

  async function startTask(nextStage: Exclude<Stage, "intake" | "report">) {
    await recordTelemetry(
      "task_started",
      { taskLabel: TASK_LABEL_BY_STAGE[nextStage] },
      TASK_ID_BY_STAGE[nextStage],
    );
    setTrialStartedAt(performance.now());
    setStage(nextStage);
  }

  async function startSession() {
    setError("");
    setIsBusy(true);

    try {
      const response = await postJson<{ session: CandidateSession }>(
        "/api/sessions",
        {
          candidateName,
          demographics,
        },
      );

      setSession(response.session);
      await postJson("/api/telemetry", {
        sessionId: response.session.id,
        taskId: "balloon-pop",
        eventType: "task_started",
        clientTime: new Date().toISOString(),
        payload: { taskLabel: "Balloon Pop" },
      });
      setStage("balloon");
      setTrialStartedAt(performance.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start.");
    } finally {
      setIsBusy(false);
    }
  }

  async function pumpBalloon() {
    if (!currentBalloonRound || balloonState !== "active") {
      return;
    }

    setError("");
    const nextPumpCount = balloonPumps + 1;
    const responseMs = Math.round(performance.now() - trialStartedAt);

    try {
      await recordTelemetry(
        "balloon_pump",
        {
          roundId: currentBalloonRound.id,
          pumpNumber: nextPumpCount,
          maxPumps: currentBalloonRound.maxPumps,
          responseMs,
        },
        "balloon-pop",
      );

      if (nextPumpCount >= currentBalloonRound.burstAt) {
        setBalloonState("burst");
        setBalloonMessage("Pop. This round earned 0 points.");
        setBalloonPumps(nextPumpCount);
        setBalloonPoints(0);
        await recordTelemetry(
          "balloon_round_completed",
          {
            roundId: currentBalloonRound.id,
            outcome: "burst",
            pumps: nextPumpCount,
            maxPumps: currentBalloonRound.maxPumps,
            bankedPoints: 0,
            responseMs,
          },
          "balloon-pop",
        );
        return;
      }

      setBalloonPumps(nextPumpCount);
      setBalloonPoints(nextPumpCount * currentBalloonRound.rewardPerPump);
      setBalloonMessage("The balloon grew. Bank now or try another pump.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save pump.",
      );
    }
  }

  async function bankBalloon() {
    if (!currentBalloonRound || balloonState !== "active") {
      return;
    }

    const responseMs = Math.round(performance.now() - trialStartedAt);
    const bankedPoints = balloonPumps * currentBalloonRound.rewardPerPump;

    setError("");

    try {
      await recordTelemetry(
        "balloon_round_completed",
        {
          roundId: currentBalloonRound.id,
          outcome: "banked",
          pumps: balloonPumps,
          maxPumps: currentBalloonRound.maxPumps,
          bankedPoints,
          responseMs,
        },
        "balloon-pop",
      );
      setBalloonState("banked");
      setTotalBankedPoints((value) => value + bankedPoints);
      setBalloonMessage(`Banked ${bankedPoints} points for this round.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not bank points.",
      );
    }
  }

  async function continueBalloon() {
    setBalloonPumps(0);
    setBalloonPoints(0);
    setBalloonState("active");
    setBalloonMessage("Pump to grow the balloon, then bank before it pops.");

    if (balloonIndex < BALLOON_ROUNDS.length - 1) {
      setBalloonIndex((value) => value + 1);
      setTrialStartedAt(performance.now());
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedRounds: BALLOON_ROUNDS.length, totalBankedPoints },
      "balloon-pop",
    );
    await recordTelemetry(
      "task_started",
      { taskLabel: "Choice Dots" },
      "choice-dots",
    );
    setStage("choice");
    setTrialStartedAt(performance.now());
  }

  function clearChoiceTimer() {
    if (choiceTimeoutRef.current) {
      window.clearTimeout(choiceTimeoutRef.current);
      choiceTimeoutRef.current = null;
    }
  }

  async function startChoiceTrial() {
    if (!currentChoiceTrial) {
      return;
    }

    clearChoiceTimer();
    stimulusStartedAt.current = null;
    setChoiceSide(null);
    setChoiceState("waiting");
    setChoiceMessage("Wait for the dot...");
    choiceTimeoutRef.current = window.setTimeout(() => {
      stimulusStartedAt.current = performance.now();
      setChoiceSide(currentChoiceTrial.targetSide);
      setChoiceState("visible");
      setChoiceMessage("Tap the matching side.");
    }, currentChoiceTrial.delayMs);
  }

  async function finishChoiceTrial(side: "left" | "right") {
    if (!currentChoiceTrial || choiceState !== "visible") {
      return;
    }

    clearChoiceTimer();
    const responseMs = stimulusStartedAt.current
      ? Math.round(performance.now() - stimulusStartedAt.current)
      : 0;
    const correct = side === currentChoiceTrial.targetSide;

    await recordTelemetry(
      "choice_trial_completed",
      {
        trialId: currentChoiceTrial.id,
        targetSide: currentChoiceTrial.targetSide,
        selectedSide: side,
        correct,
        responseMs,
      },
      "choice-dots",
    );
    setChoiceState("responded");
    setChoiceMessage(correct ? "Correct response saved." : "Wrong side saved.");
  }

  async function continueChoice() {
    if (choiceIndex < CHOICE_DOT_TRIALS.length - 1) {
      setChoiceIndex((value) => value + 1);
      setChoiceState("idle");
      setChoiceSide(null);
      setChoiceMessage("Start the next trial when ready.");
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedTrials: CHOICE_DOT_TRIALS.length },
      "choice-dots",
    );
    await startTask("trail");
    setTrailNextTarget(1);
    setTrailErrors(0);
    setTrailState("active");
  }

  async function handleTrailTap(nodeId: number) {
    if (trailState !== "active") {
      return;
    }

    if (nodeId !== trailNextTarget) {
      setTrailErrors((value) => value + 1);
      return;
    }

    if (nodeId < TRAIL_NODES.length) {
      setTrailNextTarget(nodeId + 1);
      return;
    }

    const completionMs = Math.round(performance.now() - trialStartedAt);
    await recordTelemetry(
      "trail_completed",
      {
        nodeCount: TRAIL_NODES.length,
        errors: trailErrors,
        completionMs,
      },
      "trail-path",
    );
    setTrailState("complete");
  }

  async function continueTrail() {
    await recordTelemetry(
      "task_completed",
      { completed: true },
      "trail-path",
    );
    await startTask("spatial");
    setSpatialIndex(0);
    setSpatialPhase("ready");
    setSpatialInput([]);
    setSpatialMessage("Watch the highlighted squares, then repeat the pattern.");
  }

  async function playSpatialSequence() {
    if (!currentSpatialTrial || spatialPhase === "showing") {
      return;
    }

    setSpatialPhase("showing");
    setSpatialInput([]);
    setSpatialMessage("Watch...");
    await wait(350);

    for (const cell of currentSpatialTrial.sequence) {
      setSpatialActiveCell(cell);
      await wait(420);
      setSpatialActiveCell(null);
      await wait(170);
    }

    setTrialStartedAt(performance.now());
    setSpatialPhase("input");
    setSpatialMessage("Repeat the pattern.");
  }

  async function handleSpatialCell(cell: number) {
    if (!currentSpatialTrial || spatialPhase !== "input") {
      return;
    }

    const nextInput = [...spatialInput, cell];
    setSpatialInput(nextInput);

    if (nextInput.length !== currentSpatialTrial.sequence.length) {
      return;
    }

    const errors = nextInput.reduce(
      (count, value, index) =>
        count + (value === currentSpatialTrial.sequence[index] ? 0 : 1),
      0,
    );
    const correct = errors === 0;
    const responseMs = Math.round(performance.now() - trialStartedAt);

    await recordTelemetry(
      "spatial_trial_completed",
      {
        trialId: currentSpatialTrial.id,
        spanLength: currentSpatialTrial.sequence.length,
        errors,
        correct,
        responseMs,
      },
      "spatial-span",
    );
    setSpatialPhase("feedback");
    setSpatialMessage(correct ? "Pattern matched." : "Pattern saved with errors.");
  }

  async function continueSpatial() {
    if (spatialIndex < SPATIAL_SPAN_TRIALS.length - 1) {
      setSpatialIndex((value) => value + 1);
      setSpatialInput([]);
      setSpatialPhase("ready");
      setSpatialMessage("Start the next sequence when ready.");
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedTrials: SPATIAL_SPAN_TRIALS.length },
      "spatial-span",
    );
    await startTask("pattern");
    setPatternIndex(0);
    setPatternState("active");
    setPatternMessage("Find the tile that matches the target.");
  }

  async function handlePatternChoice(index: number) {
    if (!currentPatternTrial || patternState !== "active") {
      return;
    }

    const correct = index === currentPatternTrial.targetIndex;
    const responseMs = Math.round(performance.now() - trialStartedAt);

    await recordTelemetry(
      "pattern_trial_completed",
      {
        trialId: currentPatternTrial.id,
        selectedIndex: index,
        targetIndex: currentPatternTrial.targetIndex,
        correct,
        responseMs,
      },
      "pattern-match",
    );
    setPatternState("feedback");
    setPatternMessage(correct ? "Target found." : "Response saved.");
  }

  async function continuePattern() {
    if (patternIndex < PATTERN_MATCH_TRIALS.length - 1) {
      setPatternIndex((value) => value + 1);
      setPatternState("active");
      setPatternMessage("Find the next target.");
      setTrialStartedAt(performance.now());
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedTrials: PATTERN_MATCH_TRIALS.length },
      "pattern-match",
    );
    await startTask("design");
    setDesignRound(0);
    setDesignCells([]);
    setDesignPatterns([]);
    setDesignSaved(false);
    setDesignMessage("Choose four dots to make a new pattern.");
  }

  function toggleDesignCell(cell: number) {
    if (designSaved) {
      return;
    }

    if (designCells.includes(cell)) {
      setDesignCells((cells) => cells.filter((item) => item !== cell));
      return;
    }

    if (designCells.length < 4) {
      setDesignCells((cells) => [...cells, cell]);
    }
  }

  async function submitDesignRound() {
    if (designCells.length !== 4) {
      return;
    }

    const patternKey = [...designCells].sort((a, b) => a - b).join("-");
    const repeated = designPatterns.includes(patternKey);
    const responseMs = Math.round(performance.now() - trialStartedAt);

    await recordTelemetry(
      "design_round_completed",
      {
        round: designRound + 1,
        patternKey,
        selectedCells: designCells,
        repeated,
        responseMs,
      },
      "design-grid",
    );
    setDesignPatterns((patterns) => [...patterns, patternKey]);
    setDesignSaved(true);
    setDesignMessage(
      repeated
        ? "Repeated pattern saved. Try a new design next."
        : "New design saved.",
    );
  }

  async function continueDesign() {
    if (designRound < DESIGN_GRID_ROUNDS - 1) {
      setDesignRound((value) => value + 1);
      setDesignCells([]);
      setDesignSaved(false);
      setDesignMessage("Choose four dots for a new pattern.");
      setTrialStartedAt(performance.now());
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedRounds: DESIGN_GRID_ROUNDS },
      "design-grid",
    );
    await startTask("auditory");
  }

  function clearAuditoryTimers() {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (toneRef.current) {
      window.clearTimeout(toneRef.current);
      toneRef.current = null;
    }
  }

  async function startAuditoryTrial() {
    if (!currentAuditoryTrial) {
      return;
    }

    clearAuditoryTimers();
    respondedRef.current = false;
    signalStartedAt.current = null;
    setAuditoryState("waiting");
    setAuditoryMessage("Listen carefully...");

    await recordTelemetry(
      "auditory_trial_started",
      {
        trialId: currentAuditoryTrial.id,
        signalPresent: currentAuditoryTrial.signalPresent,
        delayMs: currentAuditoryTrial.delayMs,
      },
      "auditory-screen",
    );

    toneRef.current = window.setTimeout(() => {
      if (currentAuditoryTrial.signalPresent) {
        signalStartedAt.current = performance.now();
        playTone(currentAuditoryTrial.frequencyHz);
      }
    }, currentAuditoryTrial.delayMs);

    timeoutRef.current = window.setTimeout(() => {
      void finishAuditoryTrial(false);
    }, currentAuditoryTrial.delayMs + 1800);
  }

  async function finishAuditoryTrial(detected: boolean) {
    if (!currentAuditoryTrial || respondedRef.current) {
      return;
    }

    respondedRef.current = true;
    clearAuditoryTimers();
    const signalTime = signalStartedAt.current;
    const responseMs =
      detected && signalTime ? Math.round(performance.now() - signalTime) : 0;
    const isHit = detected && currentAuditoryTrial.signalPresent && responseMs > 0;
    const falseAlarm = detected && !isHit;

    setAuditoryState("responded");
    setAuditoryMessage(
      isHit
        ? "Detected. Response saved."
        : falseAlarm
          ? "That was recorded as a false alarm."
          : currentAuditoryTrial.signalPresent
            ? "No response recorded; this was a miss."
            : "Good restraint. No tone was present.",
    );

    try {
      await recordTelemetry(
        "auditory_response",
        {
          trialId: currentAuditoryTrial.id,
          signalPresent: currentAuditoryTrial.signalPresent,
          detected,
          responseMs,
          falseAlarm,
        },
        "auditory-screen",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save trial.",
      );
    }
  }

  async function continueAuditory() {
    if (auditoryIndex < AUDITORY_TRIALS.length - 1) {
      setAuditoryIndex((value) => value + 1);
      setAuditoryState("idle");
      setAuditoryMessage("Start the next trial when ready.");
      return;
    }

    setIsBusy(true);

    try {
      await recordTelemetry(
        "task_completed",
        { completedTrials: AUDITORY_TRIALS.length },
        "auditory-screen",
      );
      await recordTelemetry("session_completed", {}, undefined);
      const response = await postJson<{ report: ScoreReport }>("/api/scores", {
        sessionId: session?.id,
      });

      setReport(response.report);
      setStage("report");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not generate report.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="card task-shell">
      <div className="progress" aria-label="Assessment progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      {error ? <div className="warning">{error}</div> : null}

      {stage === "intake" ? (
        <section className="stack">
          <span className="eyebrow">Candidate intake</span>
          <h1>Start a relational style assessment</h1>
          <p>
            This MVP captures interaction telemetry from short non-word
            cognitive mini-games and generates an explainable report. Fairness
            context is optional and only used for aggregate monitoring.
          </p>
          <div className="form-grid">
            <label>
              Candidate name
              <input
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                placeholder="Alex Morgan"
              />
            </label>
            <label>
              Age band
              <select
                value={demographics.ageBand}
                onChange={(event) =>
                  setDemographics((value) => ({
                    ...value,
                    ageBand: event.target
                      .value as CandidateDemographics["ageBand"],
                  }))
                }
              >
                <option value="prefer-not">Prefer not to say</option>
                <option value="18-24">18-24</option>
                <option value="25-34">25-34</option>
                <option value="35-44">35-44</option>
                <option value="45-54">45-54</option>
                <option value="55+">55+</option>
              </select>
            </label>
            <label>
              Hearing context
              <select
                value={demographics.hearingContext}
                onChange={(event) =>
                  setDemographics((value) => ({
                    ...value,
                    hearingContext: event.target
                      .value as CandidateDemographics["hearingContext"],
                  }))
                }
              >
                <option value="unknown">Unknown</option>
                <option value="quiet">Quiet room</option>
                <option value="shared-space">Shared space</option>
                <option value="headphones">Headphones</option>
              </select>
            </label>
          </div>
          <label>
            Primary language
            <input
              value={demographics.language}
              onChange={(event) =>
                setDemographics((value) => ({
                  ...value,
                  language: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>
              <input
                checked={demographics.consentToFairnessMonitoring}
                onChange={(event) =>
                  setDemographics((value) => ({
                    ...value,
                    consentToFairnessMonitoring: event.target.checked,
                  }))
                }
                type="checkbox"
              />{" "}
              Include my context in aggregate fairness monitoring.
            </span>
          </label>
          <button
            className="primary"
            disabled={!candidateName.trim() || isBusy}
            onClick={() => void startSession()}
            type="button"
          >
            Begin tasks
          </button>
        </section>
      ) : null}

      {stage === "balloon" && currentBalloonRound ? (
        <section className="stack">
          <span className="eyebrow">
            {TASKS[0].label} - round {balloonIndex + 1} of{" "}
            {BALLOON_ROUNDS.length}
          </span>
          <h2>Grow the balloon, then bank before it pops.</h2>
          <p className="lede">{balloonMessage}</p>
          <div className="panel stack" style={{ alignItems: "center" }}>
            <div
              aria-label={`Balloon size ${balloonPumps}`}
              style={{
                alignItems: "center",
                background:
                  balloonState === "burst"
                    ? "var(--rose)"
                    : "linear-gradient(145deg, #5d8df5, #7dc6a2)",
                borderRadius: "999px 999px 780px 780px",
                color: "#ffffff",
                display: "flex",
                fontSize: "2rem",
                fontWeight: 900,
                height: `${110 + balloonPumps * 14}px`,
                justifyContent: "center",
                transition: "all 160ms ease",
                width: `${96 + balloonPumps * 12}px`,
              }}
            >
              {balloonState === "burst" ? "POP" : balloonPoints}
            </div>
            <div className="grid three" style={{ width: "100%" }}>
              <div className="metric">
                <strong>{balloonPumps}</strong>
                <span>Pumps this round</span>
              </div>
              <div className="metric">
                <strong>{balloonPoints}</strong>
                <span>Current round value</span>
              </div>
              <div className="metric">
                <strong>{totalBankedPoints}</strong>
                <span>Total banked</span>
              </div>
            </div>
          </div>
          <div className="actions">
            {balloonState === "active" ? (
              <>
                <button
                  className="primary"
                  disabled={isBusy}
                  onClick={() => void pumpBalloon()}
                  type="button"
                >
                  Pump
                </button>
                <button
                  className="secondary"
                  disabled={isBusy || balloonPumps === 0}
                  onClick={() => void bankBalloon()}
                  type="button"
                >
                  Bank points
                </button>
              </>
            ) : (
              <button
                className="primary"
                onClick={() => void continueBalloon()}
                type="button"
              >
                {balloonIndex < BALLOON_ROUNDS.length - 1
                  ? "Next balloon"
                  : "Continue to Choice Dots"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {stage === "choice" && currentChoiceTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {taskLabel("choice-dots")} - trial {choiceIndex + 1} of{" "}
            {CHOICE_DOT_TRIALS.length}
          </span>
          <h2>Tap the side where the dot appears.</h2>
          <p className="lede">{choiceMessage}</p>
          <div className="grid two">
            {(["left", "right"] as const).map((side) => (
              <button
                className="option-button"
                disabled={choiceState !== "visible"}
                key={side}
                onClick={() => void finishChoiceTrial(side)}
                style={{
                  alignItems: "center",
                  display: "flex",
                  height: 170,
                  justifyContent: "center",
                }}
                type="button"
              >
                {choiceSide === side ? (
                  <span
                    aria-label={`${side} dot`}
                    style={{
                      background: "var(--accent)",
                      borderRadius: "999px",
                      display: "block",
                      height: 72,
                      width: 72,
                    }}
                  />
                ) : null}
              </button>
            ))}
          </div>
          <div className="actions">
            {choiceState === "idle" ? (
              <button
                className="primary"
                onClick={() => void startChoiceTrial()}
                type="button"
              >
                Start trial
              </button>
            ) : null}
            {choiceState === "responded" ? (
              <button
                className="primary"
                onClick={() => void continueChoice()}
                type="button"
              >
                {choiceIndex < CHOICE_DOT_TRIALS.length - 1
                  ? "Next dot"
                  : "Continue to Trail Path"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {stage === "trail" ? (
        <section className="stack">
          <span className="eyebrow">{taskLabel("trail-path")}</span>
          <h2>Tap the circles in order.</h2>
          <p className="lede">
            Next target: {trailNextTarget <= TRAIL_NODES.length ? trailNextTarget : "done"}.
            Errors: {trailErrors}.
          </p>
          <div
            className="panel"
            style={{
              height: 360,
              position: "relative",
            }}
          >
            {TRAIL_NODES.map((node) => {
              const isDone = node.id < trailNextTarget;
              const isNext = node.id === trailNextTarget;

              return (
                <button
                  aria-label={`Trail node ${node.id}`}
                  className="primary"
                  disabled={trailState === "complete"}
                  key={node.id}
                  onClick={() => void handleTrailTap(node.id)}
                  style={{
                    background: isDone
                      ? "var(--green)"
                      : isNext
                        ? "var(--accent)"
                        : "#ffffff",
                    border: "2px solid var(--accent)",
                    color: isDone || isNext ? "#ffffff" : "var(--ink)",
                    height: 52,
                    left: `${node.x}%`,
                    padding: 0,
                    position: "absolute",
                    top: `${node.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: 52,
                  }}
                  type="button"
                >
                  {node.id}
                </button>
              );
            })}
          </div>
          {trailState === "complete" ? (
            <div className="actions">
              <button
                className="primary"
                onClick={() => void continueTrail()}
                type="button"
              >
                Continue to Spatial Span
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {stage === "spatial" && currentSpatialTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {taskLabel("spatial-span")} - round {spatialIndex + 1} of{" "}
            {SPATIAL_SPAN_TRIALS.length}
          </span>
          <h2>Watch, then repeat the spatial pattern.</h2>
          <p className="lede">{spatialMessage}</p>
          <div
            className="panel"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            }}
          >
            {Array.from({ length: 9 }, (_, cell) => (
              <button
                aria-label={`Spatial cell ${cell + 1}`}
                className="option-button"
                disabled={spatialPhase !== "input"}
                key={cell}
                onClick={() => void handleSpatialCell(cell)}
                style={{
                  background:
                    spatialActiveCell === cell
                      ? "var(--accent)"
                      : spatialInput.includes(cell)
                        ? "#edf7f2"
                        : "#ffffff",
                  height: 76,
                }}
                type="button"
              />
            ))}
          </div>
          <div className="actions">
            {spatialPhase === "ready" ? (
              <button
                className="primary"
                onClick={() => void playSpatialSequence()}
                type="button"
              >
                Show pattern
              </button>
            ) : null}
            {spatialPhase === "feedback" ? (
              <button
                className="primary"
                onClick={() => void continueSpatial()}
                type="button"
              >
                {spatialIndex < SPATIAL_SPAN_TRIALS.length - 1
                  ? "Next pattern"
                  : "Continue to Pattern Match"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {stage === "pattern" && currentPatternTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {taskLabel("pattern-match")} - round {patternIndex + 1} of{" "}
            {PATTERN_MATCH_TRIALS.length}
          </span>
          <h2>Find the matching tile.</h2>
          <p className="lede">{patternMessage}</p>
          <div className="panel stack" style={{ alignItems: "center" }}>
            <span className="pill">Target</span>
            {renderPatternTile(currentPatternTrial.tiles[currentPatternTrial.targetIndex], 70)}
          </div>
          <div
            className="panel"
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              justifyItems: "center",
            }}
          >
            {currentPatternTrial.tiles.map((tile, index) => (
              <button
                aria-label={`Pattern tile ${index + 1}`}
                className="option-button"
                disabled={patternState !== "active"}
                key={`${tile.shape}-${tile.color}-${index}`}
                onClick={() => void handlePatternChoice(index)}
                style={{
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "center",
                  minHeight: 92,
                  width: "100%",
                }}
                type="button"
              >
                {renderPatternTile(tile)}
              </button>
            ))}
          </div>
          {patternState === "feedback" ? (
            <div className="actions">
              <button
                className="primary"
                onClick={() => void continuePattern()}
                type="button"
              >
                {patternIndex < PATTERN_MATCH_TRIALS.length - 1
                  ? "Next target"
                  : "Continue to Design Grid"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {stage === "design" ? (
        <section className="stack">
          <span className="eyebrow">
            {taskLabel("design-grid")} - round {designRound + 1} of{" "}
            {DESIGN_GRID_ROUNDS}
          </span>
          <h2>Create a new four-dot design.</h2>
          <p className="lede">{designMessage}</p>
          <div
            className="panel"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            }}
          >
            {Array.from({ length: 16 }, (_, cell) => (
              <button
                aria-label={`Design dot ${cell + 1}`}
                className="option-button"
                key={cell}
                onClick={() => toggleDesignCell(cell)}
                style={{
                  alignItems: "center",
                  background: designCells.includes(cell)
                    ? "var(--accent)"
                    : "#ffffff",
                  display: "flex",
                  height: 66,
                  justifyContent: "center",
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  style={{
                    background: designCells.includes(cell)
                      ? "#ffffff"
                      : "var(--muted)",
                    borderRadius: "999px",
                    display: "block",
                    height: 16,
                    width: 16,
                  }}
                />
              </button>
            ))}
          </div>
          <div className="actions">
            {!designSaved ? (
              <button
                className="primary"
                disabled={designCells.length !== 4}
                onClick={() => void submitDesignRound()}
                type="button"
              >
                Save design
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => void continueDesign()}
                type="button"
              >
                {designRound < DESIGN_GRID_ROUNDS - 1
                  ? "Next design"
                  : "Continue to Auditory Screen"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {stage === "auditory" && currentAuditoryTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {taskLabel("auditory-screen")} - trial {auditoryIndex + 1} of{" "}
            {AUDITORY_TRIALS.length}
          </span>
          <h2>Listen for the target tone</h2>
          <p className="lede">{auditoryMessage}</p>
          <div className="panel">
            <p>
              Keep your volume comfortable. Press the button only when you hear
              the tone; some trials have no tone.
            </p>
          </div>
          <div className="actions">
            {auditoryState === "idle" ? (
              <button
                className="primary"
                onClick={() => void startAuditoryTrial()}
                type="button"
              >
                Start trial
              </button>
            ) : null}
            {auditoryState === "waiting" ? (
              <button
                className="primary"
                onClick={() => void finishAuditoryTrial(true)}
                type="button"
              >
                I heard it
              </button>
            ) : null}
            {auditoryState === "responded" ? (
              <button
                className="primary"
                disabled={isBusy}
                onClick={() => void continueAuditory()}
                type="button"
              >
                {auditoryIndex < AUDITORY_TRIALS.length - 1
                  ? "Next trial"
                  : "Generate report"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {stage === "report" && report ? (
        <section className="stack">
          <span className="eyebrow">Report generated</span>
          <h2>{report.profileMatches[0]?.label}</h2>
          <p className="lede">{report.overallNarrative}</p>
          <div className="grid three">
            {report.traitScores.slice(0, 3).map((trait) => (
              <div className="metric" key={trait.key}>
                <strong>{trait.score}</strong>
                <span>{trait.label}</span>
              </div>
            ))}
          </div>
          <div className="actions">
            <Link className="button primary" href={`/reports/${report.sessionId}`}>
              View explainable report
            </Link>
            <Link className="button secondary" href="/developer">
              Compare in dashboard
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
