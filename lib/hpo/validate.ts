import { HpoValidationError } from "./errors";

const HPO_ID_PATTERN = /^HP:\d{7}$/;

export function normalizeHpoId(value: string): string | null {
  const normalized = value.trim();
  return HPO_ID_PATTERN.test(normalized) ? normalized : null;
}

export function isValidHpoId(value: string): boolean {
  return normalizeHpoId(value) !== null;
}

export function assertValidHpoId(value: string): string {
  const normalized = normalizeHpoId(value);
  if (!normalized) {
    throw new HpoValidationError(
      `Invalid HPO ID "${value}". Expected format is HP: followed by exactly 7 digits, for example HP:0001250.`,
    );
  }
  return normalized;
}
