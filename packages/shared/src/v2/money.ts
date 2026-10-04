const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));
const currencyExponents = new Map<string, number>();

export function isSupportedCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency) && supportedCurrencies.has(currency);
}

/** Currency amounts use integer smallest units; this function never converts currencies. */
export function currencyMinorUnitDigits(currency: string): number {
  if (!isSupportedCurrency(currency)) {
    throw new Error('Use a supported uppercase ISO currency code.');
  }
  const cached = currencyExponents.get(currency);
  if (cached !== undefined) return cached;
  const digits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (digits === undefined) throw new Error('Currency precision is unavailable.');
  currencyExponents.set(currency, digits);
  return digits;
}

/** Parse an unsigned decimal price exactly, rejecting precision the currency cannot represent. */
export function parsePriceToMinorUnits(decimalPrice: string, currency: string): number {
  const digits = currencyMinorUnitDigits(currency);
  const input = decimalPrice.trim();
  if (input.length > 100) throw new Error('Price exceeds the supported integer amount.');
  const match = /^(?:(\d+)(?:\.(\d+))?|\.(\d+))$/.exec(input);
  if (!match) throw new Error('Enter a nonnegative decimal price without symbols or separators.');
  const fraction = match[2] ?? match[3] ?? '';
  if (fraction.length > digits) {
    throw new Error(`${currency} prices support at most ${digits} fractional digits.`);
  }
  const whole = match[1] ?? '0';
  const units = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  if (units > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Price exceeds the supported integer amount.');
  return Number(units);
}

/** Render integer minor units, including signed ledger entries, without floating-point rounding. */
export function formatMoney(amountMinor: number, currency: string, locale = 'en-US'): string {
  if (!Number.isSafeInteger(amountMinor))
    throw new Error('Money must be a safe integer in currency minor units.');
  const digits = currencyMinorUnitDigits(currency);
  const negative = amountMinor < 0;
  const units = BigInt(negative ? -amountMinor : amountMinor);
  const divisor = 10n ** BigInt(digits);
  const whole = units / divisor;
  const fraction = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: Math.max(1, digits),
    maximumFractionDigits: 0,
  }).format(units % divisor);
  const value = negative ? (whole === 0n ? -0 : -whole) : whole;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .formatToParts(value)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}
