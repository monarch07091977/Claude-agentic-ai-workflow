import Link from "next/link";

const PHASES = [
  {
    number: "01",
    name: "Process deconstruction",
    body: "Log the process's real steps — handoffs, cycle time, cost, bottlenecks — and get a quantified baseline instead of an estimate.",
  },
  {
    number: "02",
    name: "Agentic feasibility",
    body: "Score every step on data complexity, decision logic, and context volatility. Each one comes back classified: Algorithmic, Agentic, or Human-required.",
  },
  {
    number: "03",
    name: "Orchestration design",
    body: "Turn the Agentic steps into an agent blueprint — role, trigger, hand-off order, and where a human has to stay in the loop.",
  },
  {
    number: "04",
    name: "Value realization",
    body: "Track baseline, current, and target for the metrics that matter, and watch the gap close as the redesign lands.",
  },
] as const;

export default function MarketingPage() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          A methodology, made repeatable
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium leading-[1.15] text-slate-900 sm:text-5xl">
          Turn a legacy process into an agent architecture — and prove it was worth it.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600">
          A four-phase workflow for deciding which steps an AI agent should actually own,
          designing the agents that own them, and measuring what changed. Run it once per
          process, or across an entire portfolio.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/portfolio"
            className="rounded bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900"
          >
            Open the portfolio
          </Link>
          <Link
            href="/guide"
            className="rounded border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400"
          >
            Read the hands-on guide
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="font-display text-2xl font-medium text-slate-900">
            Four phases. One record of the decision.
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Each phase produces a specific artifact — not a slide, a structured record you can
            point at later and ask &ldquo;why did we build it this way.&rdquo;
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-2">
            {PHASES.map((phase) => (
              <div key={phase.number} className="bg-white p-6">
                <span className="font-display text-sm text-brand-600">{phase.number}</span>
                <h3 className="mt-2 font-display text-lg font-medium text-slate-900">
                  {phase.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{phase.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-[1fr_1.2fr] sm:items-start">
          <h2 className="font-display text-2xl font-medium text-slate-900">
            Nothing lives anywhere but your own Notion workspace.
          </h2>
          <div className="space-y-3 text-slate-600">
            <p>
              Every process, step, score, agent, and metric is a page in a Notion database you
              own. There is no separate application database to keep in sync, export, or lose
              access to.
            </p>
            <p>
              That also means the raw data is always one click away from the app — open the
              workspace directly if you want to filter, sort, or hand a view to someone who will
              never log into the tool itself.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-brand-900">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-medium text-white sm:max-w-sm">
            Start with the process that&rsquo;s already costing you the most.
          </h2>
          <Link
            href="/portfolio"
            className="rounded bg-white px-5 py-2.5 text-sm font-medium text-brand-900 hover:bg-brand-50"
          >
            Open the portfolio
          </Link>
        </div>
      </section>
    </main>
  );
}
