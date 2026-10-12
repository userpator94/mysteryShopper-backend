import { dbService } from './databaseService';

export interface AdminOverviewStats {
  users: {
    total: number;
    by_role: Record<string, number>;
    active: number;
    inactive: number;
    email_verified: number;
    registered_last_7_days: number;
    registered_last_30_days: number;
  };
  applications: {
    by_status: Record<string, number>;
    total: number;
  };
  reports: {
    by_payment_status: Record<string, number>;
    total: number;
  };
  offers: {
    active: number;
    inactive: number;
    total: number;
  };
  withdraws: {
    available: boolean;
    by_status: Record<string, number>;
    pending_amount: number;
    total: number;
  };
}

export interface AdminApplicationRow {
  id: string;
  offer_id: string;
  offer_title: string | null;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  user_surname: string | null;
  status: string;
  applied_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  employer_company: string | null;
}

export interface AdminQueuesPayload {
  pending_applications: AdminApplicationRow[];
  pending_reports: Array<{
    id: string;
    offer_id: string;
    offer_title: string | null;
    user_id: string;
    user_email: string | null;
    payment_status: string;
    submitted_at: string | null;
    employer_company: string | null;
  }>;
  pending_withdraws: Array<{
    id: string;
    user_id: string;
    user_email: string | null;
    amount: number;
    status: string;
    method: string;
    created_at: string | null;
  }>;
}

function rowsToCountMap(rows: Array<{ key: string; count: string | number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.key] = Number(row.count) || 0;
  }
  return out;
}

async function tableExists(tableName: string): Promise<boolean> {
  const result = await dbService.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

export class AdminService {
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const [roleRows, userAgg, appRows, reportRows, offerAgg] = await Promise.all([
      dbService.query(`
        SELECT role AS key, COUNT(*)::int AS count
        FROM users
        GROUP BY role
      `),
      dbService.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS inactive,
          COUNT(*) FILTER (WHERE email_verified = TRUE)::int AS email_verified,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS registered_last_7_days,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS registered_last_30_days
        FROM users
      `),
      dbService.query(`
        SELECT status AS key, COUNT(*)::int AS count
        FROM offer_applications
        GROUP BY status
      `),
      dbService.query(`
        SELECT payment_status AS key, COUNT(*)::int AS count
        FROM offer_reports
        GROUP BY payment_status
      `),
      dbService.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS inactive
        FROM offers
      `)
    ]);

    const byRole = rowsToCountMap(roleRows.rows);
    const appsByStatus = rowsToCountMap(appRows.rows);
    const reportsByStatus = rowsToCountMap(reportRows.rows);
    const u = userAgg.rows[0] || {};
    const o = offerAgg.rows[0] || {};

    let withdraws: AdminOverviewStats['withdraws'] = {
      available: false,
      by_status: {},
      pending_amount: 0,
      total: 0
    };

    if (await tableExists('withdraw_requests')) {
      const [wdRows, wdAgg] = await Promise.all([
        dbService.query(`
          SELECT status AS key, COUNT(*)::int AS count
          FROM withdraw_requests
          GROUP BY status
        `),
        dbService.query(`
          SELECT
            COUNT(*)::int AS total,
            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::int AS pending_amount
          FROM withdraw_requests
        `)
      ]);
      withdraws = {
        available: true,
        by_status: rowsToCountMap(wdRows.rows),
        pending_amount: Number(wdAgg.rows[0]?.pending_amount) || 0,
        total: Number(wdAgg.rows[0]?.total) || 0
      };
    }

    return {
      users: {
        total: Number(u.total) || 0,
        by_role: byRole,
        active: Number(u.active) || 0,
        inactive: Number(u.inactive) || 0,
        email_verified: Number(u.email_verified) || 0,
        registered_last_7_days: Number(u.registered_last_7_days) || 0,
        registered_last_30_days: Number(u.registered_last_30_days) || 0
      },
      applications: {
        by_status: appsByStatus,
        total: Object.values(appsByStatus).reduce((a, b) => a + b, 0)
      },
      reports: {
        by_payment_status: reportsByStatus,
        total: Object.values(reportsByStatus).reduce((a, b) => a + b, 0)
      },
      offers: {
        active: Number(o.active) || 0,
        inactive: Number(o.inactive) || 0,
        total: Number(o.total) || 0
      },
      withdraws
    };
  }

  async listApplications(options: {
    status?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: AdminApplicationRow[]; total: number }> {
    const params: unknown[] = [];
    let where = '';
    if (options.status) {
      params.push(options.status);
      where = `WHERE oa.status = $${params.length}`;
    }

    const countResult = await dbService.query(
      `SELECT COUNT(*)::int AS total FROM offer_applications oa ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total) || 0;

    params.push(options.limit);
    const limitIdx = params.length;
    params.push(options.offset);
    const offsetIdx = params.length;

    const result = await dbService.query(
      `
      SELECT
        oa.id,
        oa.offer_id,
        o.title AS offer_title,
        oa.user_id,
        u.email AS user_email,
        u.name AS user_name,
        u.surname AS user_surname,
        oa.status,
        oa.applied_at,
        oa.approved_at,
        oa.completed_at,
        e.company AS employer_company
      FROM offer_applications oa
      LEFT JOIN offers o ON o.id = oa.offer_id
      LEFT JOIN users u ON u.id = oa.user_id
      LEFT JOIN employers e ON e.id = o.employer_id
      ${where}
      ORDER BY oa.applied_at DESC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params
    );

    return { rows: result.rows as AdminApplicationRow[], total };
  }

  async getQueues(limit = 50): Promise<AdminQueuesPayload> {
    const [appsResult, reportsResult] = await Promise.all([
      dbService.query(
        `
        SELECT
          oa.id,
          oa.offer_id,
          o.title AS offer_title,
          oa.user_id,
          u.email AS user_email,
          u.name AS user_name,
          u.surname AS user_surname,
          oa.status,
          oa.applied_at,
          oa.approved_at,
          oa.completed_at,
          e.company AS employer_company
        FROM offer_applications oa
        LEFT JOIN offers o ON o.id = oa.offer_id
        LEFT JOIN users u ON u.id = oa.user_id
        LEFT JOIN employers e ON e.id = o.employer_id
        WHERE oa.status = 'pending'
        ORDER BY oa.applied_at ASC NULLS LAST
        LIMIT $1
        `,
        [limit]
      ),
      dbService.query(
        `
        SELECT
          r.id,
          r.offer_id,
          o.title AS offer_title,
          r.user_id,
          u.email AS user_email,
          r.payment_status,
          r.submitted_at,
          e.company AS employer_company
        FROM offer_reports r
        LEFT JOIN offers o ON o.id = r.offer_id
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN employers e ON e.id = o.employer_id
        WHERE r.payment_status = 'pending'
        ORDER BY r.submitted_at ASC NULLS LAST
        LIMIT $1
        `,
        [limit]
      )
    ]);

    let pendingWithdraws: AdminQueuesPayload['pending_withdraws'] = [];
    if (await tableExists('withdraw_requests')) {
      const wdResult = await dbService.query(
        `
        SELECT
          w.id,
          w.user_id,
          u.email AS user_email,
          w.amount,
          w.status,
          w.method,
          w.created_at
        FROM withdraw_requests w
        LEFT JOIN users u ON u.id = w.user_id
        WHERE w.status IN ('pending', 'processing')
        ORDER BY w.created_at ASC NULLS LAST
        LIMIT $1
        `,
        [limit]
      );
      pendingWithdraws = wdResult.rows;
    }

    return {
      pending_applications: appsResult.rows as AdminApplicationRow[],
      pending_reports: reportsResult.rows,
      pending_withdraws: pendingWithdraws
    };
  }

  async listUsers(options: {
    role?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{
    rows: Array<{
      id: string;
      email: string;
      name: string | null;
      surname: string | null;
      role: string;
      is_active: boolean;
      email_verified: boolean;
      created_at: string | null;
    }>;
    total: number;
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.role) {
      params.push(options.role);
      conditions.push(`role = $${params.length}`);
    }
    if (options.q) {
      params.push(`%${options.q.toLowerCase()}%`);
      conditions.push(
        `(LOWER(email) LIKE $${params.length} OR LOWER(COALESCE(name, '')) LIKE $${params.length} OR LOWER(COALESCE(surname, '')) LIKE $${params.length})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await dbService.query(
      `SELECT COUNT(*)::int AS total FROM users ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total) || 0;

    params.push(options.limit);
    const limitIdx = params.length;
    params.push(options.offset);
    const offsetIdx = params.length;

    const result = await dbService.query(
      `
      SELECT id, email, name, surname, role, is_active, email_verified, created_at
      FROM users
      ${where}
      ORDER BY created_at DESC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      params
    );

    return { rows: result.rows, total };
  }
}

export const adminService = new AdminService();
