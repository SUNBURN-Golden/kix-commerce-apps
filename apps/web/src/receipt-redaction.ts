export function sweepExport(text: string): string {
  return text
    .replace(/bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "[redacted-token]")
    .replace(/(?:sk|pk|rk|tok|api)_[A-Za-z0-9_-]{6,}/gi, "[redacted-token]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, "[redacted-token]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, "[redacted-account]")
    .replace(/\b\d{12,19}\b/g, "[redacted-account]")
    .replace(/\+\d{8,15}\b/g, "[redacted-phone]");
}

