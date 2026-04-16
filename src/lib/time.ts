/**
 * Format a duration in milliseconds to a human-readable string
 * e.g., 125000 -> "2m", 3700000 -> "1h 1m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds}s`;
}

/**
 * Format a timestamp to a short date string
 * e.g., "Apr 15, 2:30 PM"
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Check if a timestamp is within quiet hours
 */
export function isQuietHours(
  quietHoursStart: number,
  quietHoursEnd: number
): boolean {
  const now = new Date();
  const hour = now.getHours();

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (quietHoursStart > quietHoursEnd) {
    return hour >= quietHoursStart || hour < quietHoursEnd;
  }

  // Handle same-day quiet hours (e.g., 14:00 - 16:00)
  return hour >= quietHoursStart && hour < quietHoursEnd;
}

/**
 * Get the age of a task in milliseconds
 */
export function taskAge(
  taskId: string,
  taskStartTimes: Record<string, number>
): number {
  return Date.now() - (taskStartTimes[taskId] ?? Date.now());
}
