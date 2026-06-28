"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AUDITORY_TRIALS, BALLOON_ROUNDS, TASKS } from "@/lib/tasks";
import type {
  CandidateDemographics,
  CandidateSession,
  ScoreReport,
  TaskId,
  TelemetryEventType,
} from "@/lib/types";

type Stage = "intake" | "balloon" | "auditory" | "report";

type TelemetryPayload = Record<string, unknown>;

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
  const [report, setReport] = useState<ScoreReport | null>(null);
  const signalStartedAt = useRef<number | null>(null);
  const respondedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const toneRef = useRef<number | null>(null);

  const currentBalloonRound = BALLOON_ROUNDS[balloonIndex];
  const currentAuditoryTrial = AUDITORY_TRIALS[auditoryIndex];
  const progress = useMemo(() => {
    if (stage === "balloon") {
      return (balloonIndex / BALLOON_ROUNDS.length) * 50;
    }

    if (stage === "auditory") {
      return 50 + (auditoryIndex / AUDITORY_TRIALS.length) * 50;
    }

    if (stage === "report") {
      return 100;
    }

    return 0;
  }, [balloonIndex, auditoryIndex, stage]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if (toneRef.current) {
        window.clearTimeout(toneRef.current);
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
      setStage("balloon");
      setTrialStartedAt(performance.now());
      await postJson("/api/telemetry", {
        sessionId: response.session.id,
        taskId: "balloon-pop",
        eventType: "task_started",
        clientTime: new Date().toISOString(),
        payload: { taskLabel: "Balloon Pop" },
      });
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
      { taskLabel: "Auditory Screen" },
      "auditory-screen",
    );
    setStage("auditory");
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
            This MVP captures interaction telemetry for two short tasks and
            generates an explainable report. Fairness context is optional and
            only used for aggregate monitoring.
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
                  : "Continue to auditory screen"}
              </button>
            )}
          </div>
        </section>
      ) : null}

      {stage === "auditory" && currentAuditoryTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {TASKS[1].label} - trial {auditoryIndex + 1} of{" "}
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
