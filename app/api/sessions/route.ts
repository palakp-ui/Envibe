import { NextResponse } from "next/server";
import { createSession } from "@/lib/storage";
import type { CandidateDemographics } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    candidateName?: string;
    demographics?: Partial<CandidateDemographics>;
  };

  if (!body.candidateName?.trim()) {
    return NextResponse.json(
      { error: "candidateName is required." },
      { status: 400 },
    );
  }

  const session = await createSession({
    candidateName: body.candidateName.trim(),
    demographics: {
      consentToFairnessMonitoring:
        body.demographics?.consentToFairnessMonitoring === true,
      ageBand: body.demographics?.ageBand,
      language: body.demographics?.language || "not-provided",
      hearingContext: body.demographics?.hearingContext || "unknown",
    },
  });

  return NextResponse.json({ session });
}
