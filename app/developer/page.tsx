import Link from "next/link";
import { RELATIONAL_STYLE_PROFILES, TRAIT_LABELS } from "@/lib/tasks";
import { readStore } from "@/lib/storage";
import type { RoleConfig, ScoreReport, TraitKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const traitKeys = Object.keys(TRAIT_LABELS) as TraitKey[];

function weightedRoleScore(report: ScoreReport, role: RoleConfig) {
  return Math.round(
    report.traitScores.reduce((sum, trait) => {
      return sum + trait.score * role.traitWeights[trait.key];
    }, 0),
  );
}

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
            Review completed candidates, their nearest style profiles, and
            role-weighted trait summaries. The dashboard keeps report
            explainability close to comparison workflows.
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
            <strong>{store.roleConfigs.length}</strong>
            <span>Role configs</span>
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
                  <th>Top style</th>
                  <th>Fit</th>
                  {store.roleConfigs.map((role) => (
                    <th key={role.id}>{role.label}</th>
                  ))}
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {completedReports.map((report) => (
                  <tr key={report.sessionId}>
                    <td>{report.candidateName}</td>
                    <td>{report.profileMatches[0]?.label}</td>
                    <td>{report.profileMatches[0]?.fit}%</td>
                    {store.roleConfigs.map((role) => (
                      <td key={role.id}>{weightedRoleScore(report, role)}</td>
                    ))}
                    <td>
                      <Link href={`/reports/${report.sessionId}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid two">
        <div className="card stack">
          <h2>Style profile library</h2>
          {RELATIONAL_STYLE_PROFILES.map((profile) => (
            <div className="panel stack" key={profile.id}>
              <h3>{profile.label}</h3>
              <p>{profile.summary}</p>
              <div className="grid two">
                {traitKeys.map((traitKey) => (
                  <div key={traitKey}>
                    <strong>{TRAIT_LABELS[traitKey]}</strong>
                    <div className="score-bar" aria-hidden="true">
                      <span style={{ width: `${profile.targets[traitKey]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>Role configuration</h2>
          {store.roleConfigs.map((role) => (
            <div className="panel stack" key={role.id}>
              <h3>{role.label}</h3>
              <p>{role.description}</p>
              {traitKeys.map((traitKey) => (
                <div key={traitKey}>
                  <strong>
                    {TRAIT_LABELS[traitKey]} -{" "}
                    {Math.round(role.traitWeights[traitKey] * 100)}%
                  </strong>
                  <div className="score-bar" aria-hidden="true">
                    <span
                      style={{ width: `${role.traitWeights[traitKey] * 100}%` }}
                    />
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
