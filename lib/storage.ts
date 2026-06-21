import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROLE_CONFIGS } from "@/lib/tasks";
import type {
  AuditLogEntry,
  CandidateSession,
  DataStore,
  ScoreReport,
  TelemetryEvent,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".relational-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function defaultStore(): DataStore {
  return {
    sessions: [],
    telemetry: [],
    reports: [],
    auditLog: [],
    roleConfigs: ROLE_CONFIGS,
  };
}

async function ensureStoreFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultStore(), null, 2));
  }
}

export async function readStore(): Promise<DataStore> {
  await ensureStoreFile();

  const raw = await readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as DataStore;

  return {
    ...defaultStore(),
    ...parsed,
    roleConfigs: parsed.roleConfigs?.length ? parsed.roleConfigs : ROLE_CONFIGS,
  };
}

export async function writeStore(store: DataStore) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

export async function appendAuditLog(
  entry: Omit<AuditLogEntry, "id" | "createdAt">,
) {
  const store = await readStore();
  store.auditLog.unshift({
    ...entry,
    id: createId("audit"),
    createdAt: new Date().toISOString(),
  });
  await writeStore(store);
}

export async function createSession(
  session: Omit<CandidateSession, "id" | "createdAt" | "status">,
) {
  const store = await readStore();
  const created: CandidateSession = {
    ...session,
    id: createId("session"),
    status: "in-progress",
    createdAt: new Date().toISOString(),
  };

  store.sessions.unshift(created);
  store.auditLog.unshift({
    id: createId("audit"),
    actor: "candidate",
    action: "session.created",
    entityId: created.id,
    createdAt: new Date().toISOString(),
    metadata: {
      targetRoleId: created.targetRoleId,
      fairnessConsent: created.demographics.consentToFairnessMonitoring,
    },
  });

  await writeStore(store);

  return created;
}

export async function appendTelemetryEvent(
  event: Omit<TelemetryEvent, "id" | "serverTime">,
) {
  const store = await readStore();
  const created: TelemetryEvent = {
    ...event,
    id: createId("event"),
    serverTime: new Date().toISOString(),
  };

  store.telemetry.push(created);

  if (
    created.eventType === "task_started" ||
    created.eventType === "task_completed" ||
    created.eventType === "session_completed"
  ) {
    store.auditLog.unshift({
      id: createId("audit"),
      actor: "candidate",
      action: created.eventType.replaceAll("_", "."),
      entityId: created.sessionId,
      createdAt: new Date().toISOString(),
      metadata: {
        taskId: created.taskId,
      },
    });
  }

  await writeStore(store);

  return created;
}

export async function saveReport(report: ScoreReport) {
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === report.sessionId);

  if (!session) {
    throw new Error("Cannot save report for unknown session.");
  }

  session.status = "completed";
  session.completedAt = report.generatedAt;
  store.reports = [
    report,
    ...store.reports.filter((item) => item.sessionId !== report.sessionId),
  ];
  store.auditLog.unshift({
    id: createId("audit"),
    actor: "system",
    action: "report.generated",
    entityId: report.sessionId,
    createdAt: new Date().toISOString(),
    metadata: {
      topProfile: report.profileMatches[0]?.profileId,
      traitCount: report.traitScores.length,
    },
  });

  await writeStore(store);
}

export async function getSessionBundle(sessionId: string) {
  const store = await readStore();
  const session = store.sessions.find((item) => item.id === sessionId);

  if (!session) {
    return null;
  }

  return {
    store,
    session,
    events: store.telemetry.filter((event) => event.sessionId === sessionId),
    report: store.reports.find((item) => item.sessionId === sessionId),
  };
}
