/**
 * Timezone-safe reference month utilities.
 * All functions operate on strings in "yyyy-MM-dd" format (always day "01").
 * No Date objects are used to avoid UTC/local timezone shifts.
 */

/**
 * Shift a reference month string by N months (negative = past, positive = future).
 * Example: shiftReferenceMonth('2026-03-01', -1) => '2026-02-01'
 */
export function shiftReferenceMonth(referenceMonth: string, offset: number): string {
  const [yearStr, monthStr] = referenceMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1; // 0-indexed

  month += offset;

  // Normalize month overflow/underflow
  while (month < 0) {
    month += 12;
    year -= 1;
  }
  while (month > 11) {
    month -= 12;
    year += 1;
  }

  const mm = String(month + 1).padStart(2, '0');
  return `${year}-${mm}-01`;
}

/**
 * Get an array of N previous reference months (most recent first).
 * Example: getPreviousReferenceMonths('2026-03-01', 3)
 *   => ['2026-02-01', '2026-01-01', '2025-12-01']
 */
export function getPreviousReferenceMonths(referenceMonth: string, count: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    result.push(shiftReferenceMonth(referenceMonth, -i));
  }
  return result;
}

/**
 * Parse year and month (0-indexed) from a reference month string.
 */
export function parseReferenceMonth(referenceMonth: string): { year: number; month: number } {
  const [yearStr, monthStr] = referenceMonth.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10) - 1, // 0-indexed
  };
}

/**
 * Build a reference month string from year and month (0-indexed).
 */
export function buildReferenceMonth(year: number, month: number): string {
  const mm = String(month + 1).padStart(2, '0');
  return `${year}-${mm}-01`;
}

/**
 * Format a reference month string for display in pt-BR.
 * Example: formatReferenceMonth('2026-03-01') => 'março de 2026'
 */
export function formatReferenceMonth(referenceMonth: string): string {
  const { year, month } = parseReferenceMonth(referenceMonth);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${months[month]} de ${year}`;
}
