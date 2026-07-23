import Link from "next/link";

const STEPS = [
  {
    number: 1,
    title: "Create a process",
    body: [
      "From the portfolio, click New process and give it a name, a short description, and an owner — the person accountable for the process today.",
      "You land straight on Phase 1 for that process.",
    ],
  },
  {
    number: 2,
    title: "Phase 1 — log the steps",
    body: [
      "Add each step the process actually goes through: its handoff type (System, Human, Cross-team, or External), cycle time in hours, cost, and whether it's a known bottleneck.",
      "Have more than a handful of steps already written down somewhere? Skip the typing — see Importing steps from a spreadsheet below.",
      "The baseline summary at the top (total cycle time, total cost, bottleneck count) updates as you go. That's the number you'll compare against in Phase 4.",
    ],
  },
  {
    number: 3,
    title: "Phase 2 — score for agentic fit",
    body: [
      "For each step, set three scores from 1 to 5: data complexity, decision logic, and context volatility.",
      "The classification updates live as you type: below 2.33 comes back Algorithmic (automate it conventionally, no agent needed), 2.33 to 3.67 comes back Agentic (a good candidate for an AI agent), above 3.67 comes back Human-required (too volatile or judgment-heavy for now).",
      "Click Save on a row once you're happy with it — the chart below plots every scored step by complexity and volatility, sized by its score.",
      "Not sure what to put from the step name alone? Suggest gives a quick guess from what's already logged. Deep dive asks a short, step-specific questionnaire instead — two questions per dimension — and Score from answers grounds the suggestion in what you actually told it. Either way, the three number inputs stay yours to edit before you click Save, and once you've answered at least one question, that Q&A is saved alongside the score as a record of why.",
    ],
  },
  {
    number: 4,
    title: "Phase 3 — design the agents",
    body: [
      "Add one agent per Agentic step from Phase 2. Give it a name, its role, and the event that triggers it.",
      "Set Upstream agent to chain it after the agent that hands off to it — the flow diagram above the form redraws in that order automatically.",
      "If this agent needs a human to approve or override it under some condition, write that condition into HITL exception rule. Agents with one are outlined in red in the diagram, so a reviewer can spot every human checkpoint at a glance.",
    ],
  },
  {
    number: 5,
    title: "Phase 4 — track the value",
    body: [
      "Add a metric for anything you want to prove moved: cycle time, cost, a quality measure, or hours reallocated to higher-value work. Set its baseline, current value, target, and unit.",
      "Each metric gets a KPI card with a progress bar toward target, and a place in the comparison chart below. The progress calculation works the same way whether the metric should go up (hours reallocated) or down (cost) — you don't need to pick a convention.",
      "Come back and update Current as the redesign rolls out; the card and chart reflect it immediately.",
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Guide</p>
      <h1 className="mt-2 font-display text-3xl font-medium text-slate-900">
        Running a process through all four phases
      </h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        This walks through one process from creation to a finished value case. Everything
        described here writes directly to your team&rsquo;s Notion workspace as you go — there&rsquo;s
        nothing to save separately.
      </p>

      <div className="mt-6 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Before your first process: someone with access to the Notion workspace needs to have
        connected an integration and run the one-time setup script. That part is covered in the{" "}
        <a
          href="https://github.com/monarch07091977/Claude-agentic-ai-workflow#setup"
          className="font-medium text-brand-600 underline"
        >
          project README
        </a>
        , not here — this guide picks up once that's done.
      </div>

      <ol className="mt-12 space-y-12">
        {STEPS.map((step) => (
          <li key={step.number} className="flex gap-5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-medium text-brand-700">
              {step.number}
            </span>
            <div>
              <h2 className="font-display text-xl font-medium text-slate-900">{step.title}</h2>
              <div className="mt-2 space-y-3 text-slate-600">
                {step.body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-16 border-t border-slate-200 pt-10">
        <h2 className="font-display text-xl font-medium text-slate-900">
          Importing steps from a spreadsheet
        </h2>
        <p className="mt-3 text-slate-600">
          On the Phase 1 tab, click <strong>Download template</strong> to get a
          <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-700">
            .xlsx
          </code>
          file with the right columns already set up, including dropdown lists for Handoff type
          and Bottleneck so you can&rsquo;t accidentally type a value the app won&rsquo;t recognize.
        </p>
        <p className="mt-3 text-slate-600">
          Fill in one row per step, leave Step name blank for any row you want skipped, then
          upload the file with <strong>Import Steps</strong>. You&rsquo;ll see how many rows imported
          and why any were skipped — nothing fails silently. New rows are added after whatever
          steps already exist, in the order they appear in the sheet.
        </p>
      </section>

      <section className="mt-16 border-t border-slate-200 pt-10">
        <h2 className="font-display text-xl font-medium text-slate-900">A few things worth knowing</h2>
        <ul className="mt-3 space-y-2 text-slate-600">
          <li>
            Every phase is add-only in this version — there&rsquo;s no delete or edit button in the
            UI. To fix a mistake, add a corrected entry and treat the old one as noise.
          </li>
          <li>
            A process&rsquo;s <strong>current phase</strong> on the portfolio dashboard doesn&rsquo;t
            advance automatically — the four tabs are always all open, work them in whatever
            order the engagement actually needs.
          </li>
          <li>
            If Notion is briefly unreachable, the affected section shows an inline error instead
            of the page breaking — refresh once it&rsquo;s back.
          </li>
        </ul>
      </section>

      <div className="mt-16 border-t border-slate-200 pt-10">
        <Link href="/portfolio" className="text-sm font-medium text-brand-600 hover:underline">
          Go to the portfolio &rarr;
        </Link>
      </div>
    </main>
  );
}
