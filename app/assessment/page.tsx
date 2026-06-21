import { AssessmentRunner } from "@/components/AssessmentRunner";

export default function AssessmentPage() {
  return (
    <main className="page">
      <div className="grid two">
        <AssessmentRunner />
        <aside className="stack">
          <div className="card stack">
            <span className="eyebrow">Interpretation guardrails</span>
            <h2>Designed for explainability</h2>
            <p>
              The MVP reports descriptive relational style signals from task
              behavior. It is not a clinical instrument, a lie detector, or a
              standalone selection mechanism.
            </p>
            <div className="warning">
              Developers should combine these results with structured
              interviews, job-relevant evidence, and fairness review before any
              consequential use.
            </div>
          </div>
          <div className="card stack">
            <span className="eyebrow">Telemetry captured</span>
            <div className="panel">Task starts and completions</div>
            <div className="panel">Choices, confidence, and response times</div>
            <div className="panel">Auditory hits, misses, and false alarms</div>
            <div className="panel">Server timestamps for audit trails</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
