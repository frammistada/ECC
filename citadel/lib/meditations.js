// Normalizes a requested mentor mode: 'direct'/'steady' stick, anything
// else (including 'default') means "use the profile's mode" → null.
export function normalizeMode(mode) {
  return mode === "direct" || mode === "steady" ? mode : null;
}
