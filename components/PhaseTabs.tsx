import Link from "next/link";

const PHASES = [
  { number: 1, label: "Deconstruction" },
  { number: 2, label: "Feasibility" },
  { number: 3, label: "Architecture" },
  { number: 4, label: "Value" },
] as const;

export function PhaseTabs({
  processId,
  activePhase,
}: {
  processId: string;
  activePhase: number;
}) {
  return (
    <nav className="mb-6 flex gap-2 border-b border-slate-200">
      {PHASES.map((phase) => (
        <Link
          key={phase.number}
          href={`/process/${processId}/phase${phase.number}`}
          className={`px-4 py-2 text-sm font-medium ${
            phase.number === activePhase
              ? "border-b-2 border-slate-900 text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Phase {phase.number}: {phase.label}
        </Link>
      ))}
    </nav>
  );
}
