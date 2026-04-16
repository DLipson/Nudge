/**
 * Generate a unique ID
 * Uses Math.random which is sufficient for local IDs
 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
