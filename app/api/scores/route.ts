import { NextResponse } from "next/server";
import { computeScoreReport } from "@/lib/scoring";
import { getSessionBundle, saveReport } from "@/lib/storage";

export async function POST(request: Request) {
  const body = (await request.json()) as { sessionId?: string };

  if (!body.sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 },
    );
  }

  const bundle = await getSessionBundle(body.sessionId);

  if (!bundle) {
    return NextResponse.json({ error: "Unknown sessionId." }, { status: 404 });
  }

  const report = computeScoreReport(bundle.session, bundle.events);
  await saveReport(report);

  return NextResponse.json({ report });
}
