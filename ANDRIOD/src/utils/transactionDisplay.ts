import type { Transaction } from '../types';
export function transactionSign(transaction: Pick<Transaction, 'type' | 'direction'>): '+' | '-' | '' {
  if (transaction.direction === 'debit' || transaction.type === 'withdrawn') return '-';
  if (transaction.direction === 'credit') return '+';
  return transaction.type === 'reconciliation' ? '' : '+';
}
