type Level = "INFO" | "WARN" | "ERROR";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "ERROR") console.error(line);
  else console.log(line);
}
