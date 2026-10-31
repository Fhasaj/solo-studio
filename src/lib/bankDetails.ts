/*
 * @name: Bank details
 * @description: Your bank details, stored encrypted. Shown in full only to signed-in clients with a payment due,
 * and to you after entering an emailed code. Everywhere else they are masked.
 * */

import { decryptValue, encryptValue } from './secureStore';
import { GetSecureValues, SaveSecureValues } from './query/security.query';
import { sqliteToIso } from './format';

const KEYS = ['bankAccountName', 'bankSortCode', 'bankAccountNumber'] as const;

export interface BankDetails {
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
}

export function GetBankDetails(): BankDetails & { updatedAt: string | null } {
  const details: BankDetails = { bankAccountName: '', bankSortCode: '', bankAccountNumber: '' };
  let updatedAt: string | null = null;
  for (const row of GetSecureValues(KEYS)) {
    try {
      details[row.key as keyof BankDetails] = decryptValue(row.value);
    } catch {
      // Wrong or rotated key: treat as missing rather than crash the portal
      console.error(`[bank details] Could not decrypt ${row.key}. Was DATA_ENCRYPTION_KEY changed?`);
    }
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }
  return { ...details, updatedAt: sqliteToIso(updatedAt) };
}

export function SaveBankDetails(details: BankDetails) {
  SaveSecureValues(Object.fromEntries(KEYS.map((key) => [key, encryptValue(details[key])])));
}

export function hasBankDetails(details: BankDetails) {
  return Boolean(details.bankAccountName && details.bankSortCode && details.bankAccountNumber);
}

export function maskBankDetails(details: BankDetails) {
  return {
    bankAccountName: details.bankAccountName,
    bankSortCode: details.bankSortCode ? `••-••-${details.bankSortCode.slice(-2)}` : '',
    bankAccountNumber: details.bankAccountNumber ? `••••${details.bankAccountNumber.slice(-4)}` : '',
  };
}
