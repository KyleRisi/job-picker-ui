export const SALARY_BENEFIT_OPTIONS = [
  '$50k + unlimited popcorn',
  '$100k + front-row chaos',
  '$20 bucks + eternal glory',
  'Peanuts (literal) + applause',
  '$75k + confetti allowance',
  '$42k + mystery bonus envelope',
  '$88k + backstage snack stipend',
  '$60k + one emergency kazoo'
];

export function normalizeSalaryBenefitOptions(options?: string[]): string[] {
  const normalized = (options || []).map((v) => `${v}`.trim()).filter(Boolean);
  return normalized.length ? normalized : SALARY_BENEFIT_OPTIONS;
}

export function getDefaultSalaryBenefits(jobRef: string, options?: string[]): string {
  const source = normalizeSalaryBenefitOptions(options);
  const idx =
    Array.from(jobRef || '').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % source.length;
  return source[idx];
}
