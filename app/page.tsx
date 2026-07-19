import Link from "next/link";
import { listProcesses } from "@/lib/notion/processes";

export const revalidate = 30;

export default async function PortfolioDashboard() {
  const processes = await listProcesses();

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
      {processes.length === 0 ? (
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
