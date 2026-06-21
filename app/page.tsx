import Link from "next/link";
import { TASKS } from "@/lib/tasks";

const platformCapabilities = [
  "Browser-based behavioral tasks with millisecond interaction telemetry.",
  "Server-side scoring pipeline with traceable trait formulas and profile matching.",
  "Developer dashboard for comparing completed candidates against relational style profiles.",
  "Audit log, role configuration, fairness monitoring hooks, and explainable reports.",
];

const roadmapTasks = [
  "BAVLT",
  "Choice Reaction Time",
  "Continuous Picture Naming",
  "Design Fluency",
  "Digit Span",
  "Face-Name Binding",
  "Hidden Patterns",
  "Stroop",
  "Trail Making",
  "Verbal Fluency",
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <div className="stack">
          <span className="eyebrow">Relational style assessment MVP</span>
          <h1>Behavioral signals for relationship science.</h1>
          <p className="lede">
            Envibe is an original Pymetrics-like platform concept that uses
            short cognitive-science-inspired tasks to build explainable,
            auditable profiles of interpersonal tendencies. It does not copy
            proprietary games or scoring systems.
          </p>
          <div className="actions">
            <Link className="button primary" href="/assessment">
              Start candidate flow
            </Link>
            <Link className="button secondary" href="/developer">
              Open dashboard
            </Link>
          </div>
        </div>

        <aside className="card stack">
          <span className="pill">Implemented now</span>
          {TASKS.map((task) => (
            <div className="panel" key={task.id}>
              <h3>{task.label}</h3>
              <p>{task.cognitiveBasis}</p>
              <p>
                <strong>Relational signal:</strong> {task.relationalSignal}
              </p>
            </div>
          ))}
        </aside>
      </section>

      <section className="grid two" style={{ marginTop: 42 }}>
        <div className="card stack">
          <h2>Full-stack architecture</h2>
          {platformCapabilities.map((capability) => (
            <div className="panel" key={capability}>
              {capability}
            </div>
          ))}
        </div>
        <div className="card stack">
          <h2>Assessment roadmap</h2>
          <p>
            The scoring pipeline is designed to accept additional task modules
            from the supplied battery as the product matures.
          </p>
          <div className="grid two">
            {roadmapTasks.map((task) => (
              <span className="pill" key={task}>
                {task}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
