import { Pool } from 'pg';
import pool from '../config/database';
import type { WithdrawDetails, WithdrawMethod } from './withdrawDetailsService';
import { formatPhone, MIN_WITHDRAW_AMOUNT } from '../utils/validators';

export type WithdrawRequestStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'rejected'
  | 'cancelled';

export type WithdrawRequest = {
  id: string;
  user_id: string;
  amount: number;
  status: WithdrawRequestStatus;
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

/** Статусы, которые резервируют/списывают баланс. */
const RESERVED_STATUSES = ['pending', 'processing', 'paid'] as const;

export class WithdrawRequestsService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async sumReservedAmount(userId: string, client?: any): Promise<number> {
    const db = client ?? this.pool;
    const res = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS s
       FROM withdraw_requests
       WHERE user_id = $1 AND status = ANY($2::text[])`,
      [userId, [...RESERVED_STATUSES]]
    );
    return Number(res.rows[0]?.s ?? 0);
  }

  async createFromDetails(params: {
    userId: string;
    amount: number;
    details: WithdrawDetails;
    availableBalance: number;
  }): Promise<WithdrawRequest> {
    const amount = Math.trunc(params.amount);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_AMOUNT) {
      const err = new Error(`Минимальная сумма вывода — ${MIN_WITHDRAW_AMOUNT} Рэшек`);
      (err as any).code = 'VALIDATION_ERROR';
      throw err;
    }
    if (amount > params.availableBalance) {
      const err = new Error('Сумма превышает доступный баланс');
      (err as any).code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    const d = params.details;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const earnedRes = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::int AS balance
         FROM rewards
         WHERE user_id = $1`,
        [params.userId]
      );
      const earned = Number(earnedRes.rows[0]?.balance ?? 0);
      const reserved = await this.sumReservedAmount(params.userId, client);
      const available = Math.max(0, earned - reserved);
      if (amount > available) {
        const err = new Error('Сумма превышает доступный баланс');
        (err as any).code = 'INSUFFICIENT_BALANCE';
        throw err;
      }

      const phoneDigits = d.phone ? String(d.phone).replace(/\D/g, '') : null;
      const res = await client.query(
        `INSERT INTO withdraw_requests (
           user_id, amount, status, method,
           last_name, first_name, middle_name,
           account_number, bik, bank_name, phone, card_number
         ) VALUES (
           $1, $2, 'pending', $3,
           $4, $5, $6,
           $7, $8, $9, $10, $11
         )
         RETURNING *`,
        [
          params.userId,
          amount,
          d.method,
          d.last_name,
          d.first_name,
          d.middle_name,
          d.account_number,
          d.bik,
          d.bank_name,
          phoneDigits,
          d.card_number,
        ]
      );
      await client.query('COMMIT');
      return mapRow(res.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

function mapRow(row: any): WithdrawRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    amount: Number(row.amount),
    status: row.status,
    method: row.method,
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

export const withdrawRequestsService = new WithdrawRequestsService();
