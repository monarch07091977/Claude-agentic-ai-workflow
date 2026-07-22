"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/notion/agents";
import type { DraftedAgent } from "@/lib/ai/draftAgents";

export function AgentDraftForm({
  processId,
  agents,
}: {
  processId: string;
  agents: AgentRecord[];
}) {
  const router = useRouter();
  const [drafting, setDrafting] = useState(false);
  const [draftAgents, setDraftAgents] = useState<DraftedAgent[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/draft-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Failed to draft agent blueprint");
        return;
      }
      if (body.agents.length === 0) {
        setError("No steps are classified Agentic yet — score steps in Phase 2 first.");
        return;
      }
      setDraftAgents(body.agents);
    } catch {
      setError("Failed to draft agent blueprint");
    } finally {
      setDrafting(false);
    }
  }

  function updateDraftAgent(
    index: number,
    field: keyof DraftedAgent,
    value: string
  ) {
    setDraftAgents((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, [field]: value } : agent))
    );
  }

  async function handleSaveAgent(index: number) {
    const draft = draftAgents[index];
    setSavingIndex(index);
    setError(null);
    try {
      const upstreamAgent = agents.find((a) => a.agentName === draft.upstreamAgentName);
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          agentName: draft.agentName,
          role: draft.role,
          triggerEvent: draft.triggerEvent,
          upstreamAgentId: upstreamAgent?.id ?? "",
          hitlExceptionRule: draft.hitlExceptionRule ?? "",
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add agent");
        return;
      }
      setDraftAgents((prev) => prev.filter((_, i) => i !== index));
      router.refresh();
    } catch {
      setError("Failed to add agent");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="mb-6 rounded border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Draft agent blueprint with AI</p>
          <p className="text-xs text-slate-500">
            Save agents in order — an agent must be saved before a later one can list it
            as its upstream agent.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDraft}
          disabled={drafting}
          className="rounded bg-brand-700 px-3 py-1.5 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft Blueprint"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {draftAgents.length > 0 && (
        <ul className="mt-2 space-y-3">
          {draftAgents.map((draft, index) => (
            <li key={index} className="rounded border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Agent Name</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.agentName}
                    onChange={(e) => updateDraftAgent(index, "agentName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Role</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.role}
                    onChange={(e) => updateDraftAgent(index, "role", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Trigger Event</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.triggerEvent}
                    onChange={(e) => updateDraftAgent(index, "triggerEvent", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Upstream Agent (by name)</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.upstreamAgentName ?? ""}
                    onChange={(e) =>
                      updateDraftAgent(index, "upstreamAgentName", e.target.value)
                    }
                    placeholder="None (starts the flow)"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500">HITL Exception Rule</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
                    value={draft.hitlExceptionRule ?? ""}
                    onChange={(e) =>
                      updateDraftAgent(index, "hitlExceptionRule", e.target.value)
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">{draft.rationale}</p>
              <button
                type="button"
                onClick={() => handleSaveAgent(index)}
                disabled={savingIndex === index}
                className="mt-2 rounded bg-brand-700 px-3 py-1 text-sm text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {savingIndex === index ? "Adding..." : "Add This Agent"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
