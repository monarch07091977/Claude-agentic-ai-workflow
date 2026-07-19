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
        <h1 className="text-2xl font-semibold">Process Portfolio</h1>
        <Link
          href="/process/new"
          className="rounded bg-slate-900 px-4 py-2 text-white"
        >
          New Process
        </Link>
      </div>
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      ) : processes.length === 0 ? (
        <p className="text-slate-500">No processes yet. Create one to get started.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200">
          {processes.map((process) => (
            <li key={process.id} className="p-4 hover:bg-slate-50">
              <Link href={`/process/${process.id}/phase1`} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{process.name}</span>
                  <span className="text-sm text-slate-500">
                    Phase {process.currentPhase} &middot; {process.status} &middot;{" "}
                    {process.totalCycleTimeHours} hrs total cycle time
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
