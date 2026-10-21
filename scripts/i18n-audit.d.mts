export interface Finding {
  file: string;
  line: number;
  column: number;
  kind: string;
  text: string;
}
export const DISPLAY_ATTRIBUTES: Set<string>;
export const VERBATIM: Map<string, string>;
export function auditSource(source: string, file?: string): Finding[];
export function auditTree(root: string): Finding[];
