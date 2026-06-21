"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ASR_TRIALS,
  AUDITORY_TRIALS,
  ROLE_CONFIGS,
  TASKS,
} from "@/lib/tasks";
import type {
  CandidateDemographics,
  CandidateSession,
  ScoreReport,
  TaskId,
  TelemetryEventType,
} from "@/lib/types";

type Stage = "intake" | "asr" | "auditory" | "report";

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
  const [targetRoleId, setTargetRoleId] = useState(ROLE_CONFIGS[0].id);
  const [demographics, setDemographics] = useState<CandidateDemographics>({
    consentToFairnessMonitoring: false,
    ageBand: "prefer-not",
    language: "English",
    hearingContext: "unknown",
  });
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [asrIndex, setAsrIndex] = useState(0);
  const [asrChoice, setAsrChoice] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [asrFeedback, setAsrFeedback] = useState("");
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

  const currentAsrTrial = ASR_TRIALS[asrIndex];
  const currentAuditoryTrial = AUDITORY_TRIALS[auditoryIndex];
  const progress = useMemo(() => {
    if (stage === "asr") {
      return (asrIndex / ASR_TRIALS.length) * 50;
    }

    if (stage === "auditory") {
      return 50 + (auditoryIndex / AUDITORY_TRIALS.length) * 50;
    }

    if (stage === "report") {
      return 100;
    }

    return 0;
  }, [asrIndex, auditoryIndex, stage]);

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
          targetRoleId,
          demographics,
        },
      );

      setSession(response.session);
      setStage("asr");
      setTrialStartedAt(performance.now());
      await postJson("/api/telemetry", {
        sessionId: response.session.id,
        taskId: "asr-calibration",
        eventType: "task_started",
        clientTime: new Date().toISOString(),
        payload: { taskLabel: "ASR Calibration" },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitAsrResponse() {
    if (!currentAsrTrial || !asrChoice) {
      return;
    }

    const correct = asrChoice === currentAsrTrial.consensusOptionId;
    const responseMs = Math.round(performance.now() - trialStartedAt);

    setIsBusy(true);
    setError("");

    try {
      await recordTelemetry(
        "asr_response",
        {
          trialId: currentAsrTrial.id,
          selectedOptionId: asrChoice,
          correct,
          confidence,
          responseMs,
        },
        "asr-calibration",
      );
      setAsrFeedback(currentAsrTrial.learningSignal);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save response.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function continueAsr() {
    setAsrChoice("");
    setConfidence(60);
    setAsrFeedback("");

    if (asrIndex < ASR_TRIALS.length - 1) {
      setAsrIndex((value) => value + 1);
      setTrialStartedAt(performance.now());
      return;
    }

    await recordTelemetry(
      "task_completed",
      { completedTrials: ASR_TRIALS.length },
      "asr-calibration",
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
              Target role
              <select
                value={targetRoleId}
                onChange={(event) => setTargetRoleId(event.target.value)}
              >
                {ROLE_CONFIGS.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
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

      {stage === "asr" && currentAsrTrial ? (
        <section className="stack">
          <span className="eyebrow">
            {TASKS[0].label} - trial {asrIndex + 1} of {ASR_TRIALS.length}
          </span>
          <h2>{currentAsrTrial.context}</h2>
          <p className="lede">{currentAsrTrial.prompt}</p>
          <div className="option-list">
            {currentAsrTrial.options.map((option) => (
              <button
                aria-pressed={asrChoice === option.id}
                className="option-button"
                disabled={Boolean(asrFeedback)}
                key={option.id}
                onClick={() => setAsrChoice(option.id)}
                type="button"
              >
                <strong>{option.label}</strong>
                <p>{option.relationalCue}</p>
              </button>
            ))}
          </div>
          <label>
            Confidence: {confidence}%
            <input
              disabled={Boolean(asrFeedback)}
              max="100"
              min="0"
              onChange={(event) => setConfidence(Number(event.target.value))}
              type="range"
              value={confidence}
            />
          </label>
          {asrFeedback ? (
            <div className="warning">{asrFeedback}</div>
          ) : null}
          <div className="actions">
            {!asrFeedback ? (
              <button
                className="primary"
                disabled={!asrChoice || isBusy}
                onClick={() => void submitAsrResponse()}
                type="button"
              >
                Submit response
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => void continueAsr()}
                type="button"
              >
                Continue
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
