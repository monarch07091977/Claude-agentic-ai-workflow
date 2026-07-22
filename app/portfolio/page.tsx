import Link from "next/link";
import { listProcesses } from "@/lib/notion/processes";

export const dynamic = "force-dynamic";

export default async function PortfolioDashboard() {
  let processes: Awaited<ReturnType<typeof listProcesses>> = [];
  let error: string | null = null;
  try {
    processes = await listProcesses();
  } catch {
    error = "Failed to load processes. Please try again.";
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Portfolio
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Process portfolio</h1>
        </div>
        <Link
          href="/process/new"
          className="rounded bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          New process
        </Link>
      </div>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : processes.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">No processes yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Create one to start deconstructing, scoring, and designing its agent architecture.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {processes.map((process) => (
            <li key={process.id} className="p-4 hover:bg-slate-50">
              <Link href={`/process/${process.id}/phase1`} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{process.name}</span>
                  <span className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Phase {process.currentPhase}
                    </span>
                    {process.status} &middot; {process.totalCycleTimeHours} hrs total cycle time
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
