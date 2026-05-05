type Level = "INFO" | "WARN" | "ERROR";

/**
 * Emit a single structured JSON log line to stdout (or stderr for errors).
 * @param level - Severity level.
 * @param event - Machine-readable event name, e.g. `"webhook_received"`.
 * @param fields - Arbitrary key/value pairs merged into the log line.
 */
export const log = (level: Level, event: string, fields: Record<string, unknown> = {}): void => {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "ERROR") console.error(line);
  else console.log(line);
};
