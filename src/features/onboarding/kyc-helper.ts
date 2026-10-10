import { KycState } from '@p2p-energy-trading-platform/typescript-sdk/gen/gridx/auth/v1/auth_pb';

export function formatKycDate(date: { year: number; month: number; day: number }): string {
  return `${date.year.toString().padStart(4, '0')}-${date.month
    .toString()
    .padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseKycDate(value: string): { year: number; month: number; day: number } {
  const parts = value.split('-');

  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error(`Invalid KYC date returned by repository: ${value}`);
  }

  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  };
}

export function toKycState(state: string): KycState {
  switch (state) {
    case 'PENDING':
      return KycState.PENDING;
    case 'VERIFIED':
      return KycState.VERIFIED;
    case 'REJECTED':
      return KycState.REJECTED;
    default:
      return KycState.UNSPECIFIED;
  }
}
