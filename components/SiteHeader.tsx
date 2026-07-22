import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-lg font-medium text-slate-900">
          Agentic Workflow Framework
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/guide" className="hover:text-slate-900">
            Guide
          </Link>
          <Link
            href="/portfolio"
            className="rounded bg-brand-700 px-3.5 py-1.5 text-white hover:bg-brand-900"
          >
            Open portfolio
          </Link>
        </nav>
      </div>
    </header>
  );
}
