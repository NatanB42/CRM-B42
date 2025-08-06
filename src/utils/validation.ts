// UUID validation utility
export function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Clean UUID value - returns valid UUID or null
export function cleanUUID(value: string | null | undefined): string | null {
  if (!value || !isValidUUID(value)) {
    return null;
  }
  return value;
}