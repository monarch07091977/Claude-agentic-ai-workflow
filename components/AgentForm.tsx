"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/notion/agents";

export function AgentForm({
  processId,
  agents,
}: {
  processId: string;
  agents: AgentRecord[];
}) {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [role, setRole] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [upstreamAgentId, setUpstreamAgentId] = useState("");
  const [hitlExceptionRule, setHitlExceptionRule] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          agentName,
          role,
          triggerEvent,
          upstreamAgentId,
          hitlExceptionRule,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Failed to add agent");
        return;
      }
      setAgentName("");
      setRole("");
      setTriggerEvent("");
      setUpstreamAgentId("");
      setHitlExceptionRule("");
      router.refresh();
    } catch {
      setError("Failed to add agent");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500">Agent Name</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Role</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Trigger Event</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Upstream Agent</label>
          <select
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={upstreamAgentId}
            onChange={(e) => setUpstreamAgentId(e.target.value)}
          >
            <option value="">None (starts the flow)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.agentName}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-slate-500">HITL Exception Rule (optional)</label>
          <input
            className="mt-1 w-full rounded border border-slate-300 p-1.5 text-sm"
            value={hitlExceptionRule}
            onChange={(e) => setHitlExceptionRule(e.target.value)}
            placeholder="e.g. Escalate to human if confidence < 80%"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {submitting ? "Adding..." : "Add Agent"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
