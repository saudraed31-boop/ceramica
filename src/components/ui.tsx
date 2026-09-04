export function StatTile({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

const TEMPERATURE_COLORS: Record<string, string> = {
  HOT: "#ef4444",
  WARM: "#f59e0b",
  QUALIFIED: "#3b82f6",
  LOW: "#6b7280",
  DISQUALIFIED: "#374151",
};

export function TemperatureBadge({ temperature }: { temperature: string }) {
  const color = TEMPERATURE_COLORS[temperature] ?? "#6b7280";
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {temperature}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--ink-soft)]">
        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
    </div>
  );
}
