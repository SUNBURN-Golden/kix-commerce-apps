/** Construct locale-neutral model copy from the English catalogue. Renderers choose the display locale.
 * Values retain template-string coercion; this helper neither interprets values nor changes model state.
 */
export function sourceMessage(template: string, params: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{(v[0-9]+)\}/g, (whole, name: string) => Object.hasOwn(params, name) ? String(params[name]) : whole);
}
