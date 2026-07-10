import { dayLine, timeLine } from "@/lib/format";

// Builds the plain-text export: every entry the user wrote and what the
// mentor said back, oldest first. Deliberately only their own written
// content — no pattern_summary, no open loops, no instrumentation. Those
// are the backend's derived notes, not the user's words.
// rows: [{ content, created_at, pageName, response }] oldest-first.
export function buildExportText(rows, now = new Date()) {
  const rule = "-".repeat(56);
  const lines = [
    "CITADEL",
    "Everything you have written, and what the mentor said back.",
    `Exported ${dayLine(now)}. Times are UTC. Entries: ${rows.length}.`,
    "",
  ];

  for (const row of rows) {
    const at = new Date(row.created_at);
    const stamp = `${dayLine(at)}, ${timeLine(at)}`;
    lines.push(rule, "");
    lines.push(row.pageName ? `${stamp} — ${row.pageName}` : stamp, "");
    lines.push((row.content || "").trim(), "");
    const response = (row.response || "").trim();
    if (response) {
      lines.push("mentor:", response, "");
    }
  }

  lines.push(rule, "", "End. This file is yours.");
  return lines.join("\n") + "\n";
}
