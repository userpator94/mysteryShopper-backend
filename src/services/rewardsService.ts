import { Pool } from 'pg';
import pool from '../config/database';

export type RewardRow = {
  id: string;
  kind: string;
  amount: number;
  status: string;
  description: string | null;
  offer_id: string | null;
  report_id: string | null;
  created_at: string;
};

export class RewardsService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async listUserRewards(params: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<{ total: number; rows: RewardRow[] }> {
    const client = await this.pool.connect();
    try {
      const totalRes = await client.query(
        'SELECT COUNT(*)::int AS c FROM rewards WHERE user_id = $1',
        [params.userId]
      );
      const total = Number(totalRes.rows[0]?.c ?? 0);
      const q = `
        SELECT
          id,
          kind,
          amount,
          status,
          description,
          offer_id,
          report_id,
          created_at
        FROM rewards
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const res = await client.query(q, [params.userId, params.limit, params.offset]);
      return { total, rows: res.rows as RewardRow[] };
    } finally {
      client.release();
    }
  }

  async getUserRewardsSummary(userId: string): Promise<{
    balance: number;
    total_earned: number;
    total_count: number;
    earned_by_kind: Record<string, number>;
    count_by_status: Record<string, number>;
  }> {
    const q = `
      SELECT
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN amount ELSE 0 END), 0)::int AS total_earned,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0)::int AS balance,
        COUNT(*)::int AS total_count
      FROM rewards
      WHERE user_id = $1
    `;
    const base = await this.pool.query(q, [userId]);
    const total_earned = Number(base.rows[0]?.total_earned ?? 0);
    const balance = Number(base.rows[0]?.balance ?? 0);
    const total_count = Number(base.rows[0]?.total_count ?? 0);

    const byKindRes = await this.pool.query(
      `SELECT kind, COALESCE(SUM(amount), 0)::int AS s
       FROM rewards
       WHERE user_id = $1 AND status <> 'cancelled'
       GROUP BY kind`,
      [userId]
    );
    const earned_by_kind: Record<string, number> = {};
    for (const r of byKindRes.rows) {
      earned_by_kind[String(r.kind)] = Number(r.s ?? 0);
    }

    const byStatusRes = await this.pool.query(
      `SELECT status, COUNT(*)::int AS c
       FROM rewards
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );
    const count_by_status: Record<string, number> = {};
    for (const r of byStatusRes.rows) {
      count_by_status[String(r.status)] = Number(r.c ?? 0);
    }

    return { balance, total_earned, total_count, earned_by_kind, count_by_status };
  }

  /**
   * Начислить бонусы за отчёт (idempotent по report_id).
   * amount: целое число бонусов (1 бонус = 1 единица вознаграждения).
   */
  async creditForReport(params: {
    userId: string;
    offerId: string;
    applicationId: string;
    reportId: string;
    amount: number;
    kind?: string;
    description?: string | null;
    client?: any;
  }): Promise<void> {
    const kind = params.kind ?? 'bonus';
    const client = params.client ?? (await this.pool.connect());
    const shouldRelease = params.client == null;
    try {
      const q = `
        INSERT INTO rewards (user_id, offer_id, application_id, report_id, kind, amount, status, description)
        VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)
        ON CONFLICT (report_id) DO NOTHING
      `;
      await client.query(q, [
        params.userId,
        params.offerId,
        params.applicationId,
        params.reportId,
        kind,
        Math.max(0, Math.trunc(params.amount)),
        params.description ?? null
      ]);
    } finally {
      if (shouldRelease) client.release();
    }
  }
}

export const rewardsService = new RewardsService();

