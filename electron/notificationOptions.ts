export interface NotificationOptions {
  autoDismiss?: boolean;
  durationMs?: number;
}

export interface ResolvedNotificationOptions {
  autoDismiss: boolean;
  durationMs: number;
  timeoutType: "never";
}

const DEFAULT_NOTIFICATION_DURATION_MS = 8_000;
const MIN_NOTIFICATION_DURATION_MS = 1_000;
const MAX_NOTIFICATION_DURATION_MS = 300_000;

export function getNotificationOptions(
  options?: NotificationOptions
): ResolvedNotificationOptions {
  const durationMs =
    typeof options?.durationMs === "number" && Number.isFinite(options.durationMs)
      ? Math.min(
          MAX_NOTIFICATION_DURATION_MS,
          Math.max(MIN_NOTIFICATION_DURATION_MS, options.durationMs)
        )
      : DEFAULT_NOTIFICATION_DURATION_MS;

  return {
    autoDismiss: options?.autoDismiss !== false,
    durationMs,
    timeoutType: "never",
  };
}