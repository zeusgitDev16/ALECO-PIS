export function normalizeRealtimeModule(moduleValue) {
  return String(moduleValue || '').trim().toLowerCase();
}

export function matchesRealtimeModule(moduleValue, ...allowedModules) {
  const normalized = normalizeRealtimeModule(moduleValue);
  if (!normalized) return false;
  return allowedModules.some((candidate) => normalized === normalizeRealtimeModule(candidate));
}

