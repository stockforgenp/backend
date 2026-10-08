/**
 * Date utility helpers for subscription calculations
 */

export function addDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + days);
  return result;
}

export function isDateExpired(dateInput: string | Date): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.getTime() <= Date.now();
}

export function getRemainingDays(dateInput: string | Date): number {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const diffTime = date.getTime() - Date.now();
  if (diffTime <= 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function calculateNewExpiryDate(
  currentExpiryStr: string | undefined,
  additionalDays: number,
): { newExpiryDate: string; previousExpiryDate: string; wasExpired: boolean } {
  const now = new Date();
  let baseDate = now;
  let wasExpired = true;

  if (currentExpiryStr) {
    const currentExpiry = new Date(currentExpiryStr);
    if (
      !isNaN(currentExpiry.getTime()) &&
      currentExpiry.getTime() > now.getTime()
    ) {
      // Current subscription is still active: add days onto existing expiry
      baseDate = currentExpiry;
      wasExpired = false;
    }
  }

  const newExpiry = addDays(baseDate, additionalDays);

  return {
    previousExpiryDate: currentExpiryStr || now.toISOString(),
    newExpiryDate: newExpiry.toISOString(),
    wasExpired,
  };
}
