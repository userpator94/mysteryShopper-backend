import { Pool } from 'pg';
import pool from '../config/database';
import { formatPhone, normalizePhone } from '../utils/validators';

export type WithdrawMethod = 'bank_account' | 'phone' | 'card';

export type WithdrawDetails = {
  user_id: string;
  method: WithdrawMethod;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  account_number: string | null;
  bik: string | null;
  bank_name: string | null;
  phone: string | null;
  card_number: string | null;
  created_at: string;
  updated_at: string;
};

export type WithdrawDetailsInput = {
  method: WithdrawMethod;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  account_number?: string | null;
  bik?: string | null;
  bank_name?: string | null;
  phone?: string | null;
  card_number?: string | null;
};

export type WithdrawDefaults = {
  last_name: string;
  first_name: string;
  middle_name: string | null;
  phone: string;
};

const SELECT_COLS = `
  user_id, method, last_name, first_name, middle_name,
  account_number, bik, bank_name, phone, card_number,
  created_at, updated_at
`;

function mapRow(row: any): WithdrawDetails {
  return {
    user_id: row.user_id,
    method: row.method as WithdrawMethod,
    last_name: row.last_name,
    first_name: row.first_name,
    middle_name: row.middle_name ?? null,
    account_number: row.account_number ?? null,
    bik: row.bik ?? null,
    bank_name: row.bank_name ?? null,
    phone: row.phone ? formatPhone(String(row.phone)) : null,
    card_number: row.card_number ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class WithdrawDetailsService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async getByUserId(userId: string): Promise<WithdrawDetails | null> {
    const res = await this.pool.query(
      `SELECT ${SELECT_COLS}
       FROM withdraw_details
       WHERE user_id = $1`,
      [userId]
    );
    const row = res.rows[0];
    return row ? mapRow(row) : null;
  }

  /** ФИО и телефон из профиля для подстановки в форму. */
  async getDefaultsFromUser(userId: string): Promise<WithdrawDefaults> {
    const res = await this.pool.query(
      `SELECT COALESCE(surname, '') AS last_name,
              COALESCE(name, '') AS first_name,
              phone
       FROM users
       WHERE id = $1`,
      [userId]
    );
    const row = res.rows[0] as
      | { last_name?: string; first_name?: string; phone?: string | null }
      | undefined;
    const phoneRaw = row?.phone ? String(row.phone) : '';
    const phoneDigits = normalizePhone(phoneRaw);
    return {
      last_name: String(row?.last_name ?? '').trim(),
      first_name: String(row?.first_name ?? '').trim(),
      middle_name: null,
      phone: phoneDigits ? formatPhone(phoneDigits) : '',
    };
  }

  async upsert(userId: string, input: WithdrawDetailsInput): Promise<WithdrawDetails> {
    const method = input.method;
    const middleName =
      typeof input.middle_name === 'string' && input.middle_name.trim()
        ? input.middle_name.trim()
        : null;

    let accountNumber: string | null = null;
    let bik: string | null = null;
    let bankName: string | null = null;
    let phone: string | null = null;
    let cardNumber: string | null = null;

    if (method === 'bank_account') {
      accountNumber = String(input.account_number ?? '').replace(/\D/g, '');
      bik = String(input.bik ?? '').replace(/\D/g, '');
      bankName =
        typeof input.bank_name === 'string' && input.bank_name.trim()
          ? input.bank_name.trim()
          : null;
    } else if (method === 'phone') {
      phone = normalizePhone(String(input.phone ?? ''));
      bankName =
        typeof input.bank_name === 'string' && input.bank_name.trim()
          ? input.bank_name.trim()
          : null;
    } else {
      cardNumber = String(input.card_number ?? '').replace(/\D/g, '');
    }

    const res = await this.pool.query(
      `INSERT INTO withdraw_details (
         user_id, method, last_name, first_name, middle_name,
         account_number, bik, bank_name, phone, card_number
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         method = EXCLUDED.method,
         last_name = EXCLUDED.last_name,
         first_name = EXCLUDED.first_name,
         middle_name = EXCLUDED.middle_name,
         account_number = EXCLUDED.account_number,
         bik = EXCLUDED.bik,
         bank_name = EXCLUDED.bank_name,
         phone = EXCLUDED.phone,
         card_number = EXCLUDED.card_number,
         updated_at = NOW()
       RETURNING ${SELECT_COLS}`,
      [
        userId,
        method,
        input.last_name.trim(),
        input.first_name.trim(),
        middleName,
        accountNumber,
        bik,
        bankName,
        phone,
        cardNumber,
      ]
    );
    return mapRow(res.rows[0]);
  }
}

export const withdrawDetailsService = new WithdrawDetailsService();
