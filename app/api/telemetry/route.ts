import { NextResponse } from "next/server";
import { TASKS } from "@/lib/tasks";
import { appendTelemetryEvent, readStore } from "@/lib/storage";
import type { TaskId, TelemetryEventType } from "@/lib/types";

const VALID_TASK_IDS = new Set(TASKS.map((task) => task.id));
const VALID_EVENT_TYPES = new Set<TelemetryEventType>([
  "session_created",
  "task_started",
  "asr_response",
  "auditory_trial_started",
  "auditory_response",
  "task_completed",
  "session_completed",
]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    taskId?: TaskId;
    eventType?: TelemetryEventType;
    clientTime?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.sessionId || !body.eventType) {
    return NextResponse.json(
      { error: "sessionId and eventType are required." },
      { status: 400 },
    );
  }

  if (!VALID_EVENT_TYPES.has(body.eventType)) {
    return NextResponse.json({ error: "Unsupported eventType." }, { status: 400 });
  }

  if (body.taskId && !VALID_TASK_IDS.has(body.taskId)) {
    return NextResponse.json({ error: "Unsupported taskId." }, { status: 400 });
  }

  const store = await readStore();
  const sessionExists = store.sessions.some(
    (session) => session.id === body.sessionId,
  );

  if (!sessionExists) {
    return NextResponse.json({ error: "Unknown sessionId." }, { status: 404 });
  }

  const event = await appendTelemetryEvent({
    sessionId: body.sessionId,
    taskId: body.taskId,
    eventType: body.eventType,
    clientTime: body.clientTime,
    payload: body.payload || {},
  });

  return NextResponse.json({ event });
}
