import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionBundle } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const bundle = await getSessionBundle(sessionId);

  if (!bundle?.report) {
    notFound();
  }

  const { report, events } = bundle;

  return (
    <main className="page stack">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">Explainable report</span>
          <h1>{report.candidateName}</h1>
          <p className="lede">{report.overallNarrative}</p>
          <div className="actions">
            <Link className="button primary" href="/developer">
              Back to dashboard
            </Link>
            <Link className="button secondary" href="/assessment">
              Run another assessment
            </Link>
          </div>
        </div>
        <div className="card grid two">
          <div className="metric">
            <strong>{report.profileMatches[0]?.fit}%</strong>
            <span>Top profile fit</span>
          </div>
          <div className="metric">
            <strong>{events.length}</strong>
            <span>Telemetry events</span>
          </div>
          <div className="metric">
            <strong>{report.profileMatches[0]?.label}</strong>
            <span>Assigned by system</span>
          </div>
          <div className="metric">
            <strong>{new Date(report.generatedAt).toLocaleDateString()}</strong>
            <span>Generated</span>
          </div>
        </div>
      </section>

      <section className="grid two">
        <div className="card stack">
          <h2>Relational trait scores</h2>
          {report.traitScores.map((trait) => (
            <div className="panel stack" key={trait.key}>
              <div>
                <h3>
                  {trait.label}: {trait.score}
                </h3>
                <div className="score-bar" aria-hidden="true">
                  <span style={{ width: `${trait.score}%` }} />
                </div>
              </div>
              <p>{trait.explanation}</p>
              <ul>
                {trait.evidence.map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>Profile matches</h2>
          {report.profileMatches.map((profile) => (
            <div className="panel stack" key={profile.profileId}>
              <h3>
                {profile.label}: {profile.fit}% fit
              </h3>
              <div className="score-bar" aria-hidden="true">
                <span style={{ width: `${profile.fit}%` }} />
              </div>
              <p>{profile.summary}</p>
              {profile.gaps.length ? (
                <ul>
                  {profile.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : (
                <span className="pill">No large profile gaps</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid two">
        <div className="card stack">
          <h2>Task metrics</h2>
          {report.taskScores.map((task) => (
            <div className="panel stack" key={task.taskId}>
              <h3>{task.label}</h3>
              <p>{task.explanation}</p>
              <div className="grid two">
                {Object.entries(task.metrics).map(([metric, value]) => (
                  <div className="metric" key={metric}>
                    <strong>{value}</strong>
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>Use caveats</h2>
          {report.caveats.map((caveat) => (
            <div className="warning" key={caveat}>
              {caveat}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
