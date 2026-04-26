// LeadStack — StatusBar (Block 1)
// 28px persistent footer with workspace stats + keyboard hints.
import { useEffect, useState } from "react";

interface StatusBarProps {
  totalLeads?: number;
  newToday?: number;
  backendOnline?: boolean;
  onCommandPalette?: () => void;
}

export default function StatusBar({
  totalLeads,
  newToday = 0,
  backendOnline = true,
  onCommandPalette,
}: StatusBarProps) {
  const [count, setCount] = useState<number | undefined>(totalLeads);

  // Keep the bar populated even when the parent hasn't fetched stats yet.
  useEffect(() => {
    if (typeof totalLeads === "number") {
      setCount(totalLeads);
      return;
    }
    let cancelled = false;
    fetch("http://localhost:7432/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data && typeof data.totalLeads === "number") {
          setCount(data.totalLeads);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [totalLeads]);

  return (
    <div
      className="flex items-center justify-between flex-shrink-0 px-4"
      style={{
        height: 28,
        background: "var(--bg-base)",
        borderTop: "1px solid var(--border-divider)",
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <div className="flex items-center gap-3">
        <span>
          <span className="ls-num" style={{ color: "var(--text-secondary)" }}>
            {typeof count === "number" ? count.toLocaleString() : "—"}
          </span>{" "}
          leads in workspace
        </span>
        {newToday > 0 && (
          <>
            <span style={{ color: "var(--text-ghost)" }}>·</span>
            <span>
              <span className="ls-num" style={{ color: "var(--success)" }}>
                {newToday}
              </span>{" "}
              new today
            </span>
          </>
        )}
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span style={{ color: backendOnline ? "var(--success)" : "var(--danger)" }}>
          {backendOnline ? "Backend connected" : "Backend offline"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onCommandPalette}
          className="flex items-center gap-1.5 hover:text-[#a1a09c] transition-colors"
        >
          <span className="ls-kbd">⌘K</span>
          <span>Commands</span>
        </button>
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span className="flex items-center gap-1.5">
          <span className="ls-kbd">⌘/</span>
          <span>Search</span>
        </span>
        <span style={{ color: "var(--text-ghost)" }}>·</span>
        <span className="flex items-center gap-1.5">
          <span className="ls-kbd">?</span>
          <span>Help</span>
        </span>
      </div>
    </div>
  );
}
