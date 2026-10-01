export interface CreditLedgerEntry {
  id: string;
  sourceEventId: string;
  reversesId: string | null;
  currency: string;
  kind: string;
  amountCents: number;
}

export interface CreditBalance {
  currency: string;
  earnedCents: number;
  appliedCents: number;
  reversedCents: number;
  expiredCents: number;
  availableCents: number;
}

/** Earned rewards still waiting to be transferred, reversed, or expired. */
export function ledgerBalances(entries: CreditLedgerEntry[]): CreditBalance[] {
  const balances = new Map<string, CreditBalance>();
  const earnings = new Map<string, CreditLedgerEntry>();
  const consumed = new Map<string, number>();
  const unmatched = new Map<string, number>();
  for (const entry of entries) {
    const balance = balances.get(entry.currency) ?? {
      currency: entry.currency, earnedCents: 0, appliedCents: 0,
      reversedCents: 0, expiredCents: 0, availableCents: 0,
    };
    if (entry.kind === 'EARNED') {
      balance.earnedCents += entry.amountCents;
      earnings.set(entry.id, entry);
    } else if (entry.kind === 'APPLIED') balance.appliedCents += entry.amountCents;
    else if (entry.kind === 'REVERSED') balance.reversedCents += entry.amountCents;
    else if (entry.kind === 'EXPIRED') balance.expiredCents += entry.amountCents;
    balances.set(entry.currency, balance);
  }
  for (const entry of entries) {
    if (!['APPLIED', 'REVERSED', 'EXPIRED'].includes(entry.kind)) continue;
    const earnedId = entry.kind === 'REVERSED' ? entry.reversesId :
      entry.sourceEventId.startsWith(entry.kind === 'APPLIED' ? 'apply:' : 'expire:') ?
        entry.sourceEventId.slice(entry.sourceEventId.indexOf(':') + 1) : null;
    const earned = earnedId ? earnings.get(earnedId) : null;
    if (earned && earned.currency === entry.currency) {
      // An applied reward's refund debits Stripe; it cannot consume a later
      // unrelated reward that is still waiting to be applied.
      consumed.set(earned.id, (consumed.get(earned.id) ?? 0) + entry.amountCents);
    } else unmatched.set(entry.currency, (unmatched.get(entry.currency) ?? 0) + entry.amountCents);
  }
  for (const earned of earnings.values()) {
    balances.get(earned.currency)!.availableCents += Math.max(0, earned.amountCents - (consumed.get(earned.id) ?? 0));
  }
  for (const balance of balances.values()) balance.availableCents = Math.max(0, balance.availableCents - (unmatched.get(balance.currency) ?? 0));
  return [...balances.values()];
}
