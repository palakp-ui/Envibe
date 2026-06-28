import Link from "next/link";
import { RELATIONAL_STYLE_PROFILES, TRAIT_LABELS } from "@/lib/tasks";
import { readStore } from "@/lib/storage";
import type { ScoreReport, TraitKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const traitKeys = Object.keys(TRAIT_LABELS) as TraitKey[];

const cognitiveTraitMap = [
  {
    task: "Balloon Pop",
    signal: "Risk-reward learning",
    traits: "initiative, restraint, boundary clarity, learning after feedback",
  },
  {
    task: "Auditory Screen",
    signal: "Signal detection and response inhibition",
    traits: "attunement, patience, response control, ambiguity tolerance",
  },
];

export default async function DeveloperPage() {
  const store = await readStore();
  const completedReports = store.reports;

  return (
    <main className="page stack">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">Developer dashboard</span>
          <h1>Compare relational style signals.</h1>
          <p className="lede">
            Review completed candidates, their system-assigned style profiles,
            and the cognitive mini-game signals that drove each trait score.
            The dashboard keeps explainability close to comparison workflows.
          </p>
          <div className="actions">
            <Link className="button primary" href="/assessment">
              Run a candidate
            </Link>
            <Link className="button secondary" href="/admin">
              View governance hooks
            </Link>
          </div>
        </div>
        <div className="card grid two">
          <div className="metric">
            <strong>{store.sessions.length}</strong>
            <span>Total sessions</span>
          </div>
          <div className="metric">
            <strong>{completedReports.length}</strong>
            <span>Completed reports</span>
          </div>
          <div className="metric">
            <strong>{store.auditLog.length}</strong>
            <span>Audit events</span>
          </div>
          <div className="metric">
            <strong>{RELATIONAL_STYLE_PROFILES.length}</strong>
            <span>System profiles</span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Candidate comparison</h2>
        {completedReports.length === 0 ? (
          <div className="warning">
            No completed reports yet. Run the candidate assessment to populate
            the dashboard.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>System-assigned profile</th>
                  <th>Fit</th>
                  <th>Strongest trait</th>
                  <th>Growth signal</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {completedReports.map((report) => {
                  const sortedTraits = [...report.traitScores].sort(
                    (a, b) => b.score - a.score,
                  );
                  const strongest = sortedTraits[0];
                  const growth = sortedTraits[sortedTraits.length - 1];

                  return (
                    <tr key={report.sessionId}>
                      <td>{report.candidateName}</td>
                      <td>{report.profileMatches[0]?.label}</td>
                      <td>{report.profileMatches[0]?.fit}%</td>
                      <td>
                        {strongest?.label} ({strongest?.score})
                      </td>
                      <td>
                        {growth?.label} ({growth?.score})
                      </td>
                      <td>
                        <Link href={`/reports/${report.sessionId}`}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid two">
        <div className="card stack">
          <h2>Cognitive task to psychological trait map</h2>
          {cognitiveTraitMap.map((mapping) => (
            <div className="panel stack" key={mapping.task}>
              <h3>{mapping.task}</h3>
              <p>
                <strong>{mapping.signal}</strong>
              </p>
              <p>{mapping.traits}</p>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>System profile library</h2>
          {RELATIONAL_STYLE_PROFILES.map((profile) => (
            <div className="panel stack" key={profile.id}>
              <h3>{profile.label}</h3>
              <p>{profile.summary}</p>
              {traitKeys.map((traitKey) => (
                <div key={traitKey}>
                  <strong>{TRAIT_LABELS[traitKey]}</strong>
                  <div className="score-bar" aria-hidden="true">
                    <span style={{ width: `${profile.targets[traitKey]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
