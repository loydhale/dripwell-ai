import { describe, expect, test } from 'vitest';
import { ledgerBalances, type CreditLedgerEntry } from './credits';

function entry(id: string, kind: string, amountCents: number, currency = 'USD', earnedId: string | null = null): CreditLedgerEntry {
  return { id, kind, amountCents, currency, reversesId: kind === 'REVERSED' ? earnedId : null,
    sourceEventId: kind === 'APPLIED' ? `apply:${earnedId}` : kind === 'EXPIRED' ? `expire:${earnedId}` : `${kind.toLowerCase()}:${id}` };
}

describe('available referral credits from real ledger semantics', () => {
  test('does not count positive application, reversal, or expiry events as new earnings', () => {
    const values = [entry('a', 'EARNED', 1000), entry('b', 'EARNED', 1500), entry('c', 'EARNED', 2000), entry('d', 'EARNED', 3000),
      entry('applied', 'APPLIED', 1000, 'USD', 'a'), entry('reversed', 'REVERSED', 1500, 'USD', 'b'), entry('expired', 'EXPIRED', 2000, 'USD', 'c')];
    expect(ledgerBalances(values)).toEqual([{ currency: 'USD', earnedCents: 7500, appliedCents: 1000, reversedCents: 1500, expiredCents: 2000, availableCents: 3000 }]);
  });
  test('a refunded applied reward cannot consume a later unrelated reward', () => {
    const balance = ledgerBalances([entry('old', 'EARNED', 2500), entry('applied', 'APPLIED', 2500, 'USD', 'old'),
      entry('refund', 'REVERSED', 2500, 'USD', 'old'), entry('new', 'EARNED', 2500)]);
    expect(balance[0].availableCents).toBe(2500);
  });
  test('keeps currency balances separate and does not treat ledger row order as business state', () => {
    const entries = [entry('usd', 'EARNED', 1250), entry('jpy', 'EARNED', 5000, 'JPY'), entry('jpy-use', 'APPLIED', 5000, 'JPY', 'jpy')];
    const balances = ledgerBalances(entries.reverse());
    expect(balances.find(value => value.currency === 'USD')?.availableCents).toBe(1250);
    expect(balances.find(value => value.currency === 'JPY')?.availableCents).toBe(0);
  });
});
