/**
 * Local-first mode: Base44 is used only when VITE_ENABLE_BASE44 === "true".
 * Any other value (unset, "false", etc.) → no Base44 HTTP calls / SDK init.
 */
export function isBase44Enabled() {
  return import.meta.env.VITE_ENABLE_BASE44 === "true";
}
