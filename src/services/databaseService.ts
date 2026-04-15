import { Pool } from 'pg';
import pool from '../config/database';
import { MAX_PARTICIPANTS_UNLIMITED } from '../config/offerLimits';
import { userInitials, formatExecutorMaskLabel, formatExecutorDottedInitials } from '../utils/userDisplay';

/**
 * Число занятых мест считаем из offer_applications, чтобы не зависеть от поля offers.current_participants,
 * которое может быть не синхронизировано (без триггеров/cron).
 */
const OCCUPIED_SLOTS_EXPR = `(
  SELECT COUNT(*)::int
  FROM offer_applications oa_cnt
  WHERE oa_cnt.offer_id = o.id
    AND oa_cnt.status IN ('approved', 'in_progress', 'completed')
)`;

/** Свободные места; при «без лимита» (999) — NULL. */
const AVAILABLE_SLOTS_EXPR = `(CASE
  WHEN o.max_participants = ${MAX_PARTICIPANTS_UNLIMITED} THEN NULL
  ELSE GREATEST(
    0,
    (COALESCE(NULLIF(o.max_participants, 0), 1) - ${OCCUPIED_SLOTS_EXPR})
  )
END)`;

/** Очищает одну строку тега от кавычек и обратных слешей */
function cleanTag(s: string): string {
  return s.replace(/["\\]/g, '').trim();
}

/** Приводит tags из БД к массиву строк для API. Всегда возвращает обычный string[] без экранирования. */
function normalizeTags(value: unknown): string[] {
  if (value == null) return [];

  let arr: string[] = [];

  if (Array.isArray(value)) {
    arr = value.map((t) => (typeof t === 'string' ? t : String(t)));
  } else if (typeof value === 'string') {
    const s = value.trim();
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        arr = parsed.map((t) => (typeof t === 'string' ? t : String(t)));
      } else {
        arr = s.split(',').map((x) => x.trim());
      }
    } catch (_) {
      arr = s.split(',').map((x) => x.trim());
    }
  }

  return arr.map(cleanTag).filter(Boolean);
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  // Общий метод для выполнения запросов
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Получить все активные предложения (employer_name/surname из users по e.user_id или из e)
  async getActiveOffers(): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        ${OCCUPIED_SLOTS_EXPR} as current_participants,
        u.name as employer_name,
        u.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        ${AVAILABLE_SLOTS_EXPR} as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.is_active = TRUE 
        AND o.start_date <= NOW() 
        AND o.end_date >= NOW()
        AND e.is_active = TRUE
        AND (${AVAILABLE_SLOTS_EXPR} IS NULL OR ${AVAILABLE_SLOTS_EXPR} > 0)
      ORDER BY o.created_at DESC
    `;
    
    const result = await this.query(query);
    return result.rows.map((row: { tags?: unknown }) => ({ ...row, tags: normalizeTags(row.tags) }));
  }

  // Получить промо-предложения
  async getPromoOffers(): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        ${OCCUPIED_SLOTS_EXPR} as current_participants,
        u.name as employer_name,
        u.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        ${AVAILABLE_SLOTS_EXPR} as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.is_promo = TRUE 
        AND o.is_active = TRUE 
        AND o.start_date <= NOW() 
        AND o.end_date >= NOW()
        AND e.is_active = TRUE
        AND (${AVAILABLE_SLOTS_EXPR} IS NULL OR ${AVAILABLE_SLOTS_EXPR} > 0)
      ORDER BY o.created_at DESC
    `;
    
    const result = await this.query(query);
    return result.rows.map((row: { tags?: unknown }) => ({ ...row, tags: normalizeTags(row.tags) }));
  }

  /**
   * Редактирование задачи заказчиком запрещено, если есть отчёт
   * или заявка в статусе «в работе» (принята / выполняется / завершена).
   */
  async offerEditLocked(offerId: string): Promise<boolean> {
    const q = `
      SELECT (
        EXISTS (SELECT 1 FROM offer_reports r WHERE r.offer_id = $1)
        OR EXISTS (
          SELECT 1 FROM offer_applications oa
          WHERE oa.offer_id = $1
            AND oa.status IN ('approved', 'in_progress', 'completed')
        )
      ) AS locked
    `;
    const r = await this.query(q, [offerId]);
    return Boolean(r.rows[0]?.locked);
  }

  // Получить предложение по ID
  async getOfferById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        o.*,
        ${OCCUPIED_SLOTS_EXPR} as current_participants,
        u.name as employer_name,
        u.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        ${AVAILABLE_SLOTS_EXPR} as available_slots,
        NOT (
          EXISTS (SELECT 1 FROM offer_reports r WHERE r.offer_id = o.id)
          OR EXISTS (
            SELECT 1 FROM offer_applications oa
            WHERE oa.offer_id = o.id
              AND oa.status IN ('approved', 'in_progress', 'completed')
          )
        ) AS can_edit
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.id = $1
    `;
    
    const result = await this.query(query, [id]);
    const row = result.rows[0] || null;
    return row ? { ...row, tags: normalizeTags(row.tags) } : null;
  }

  /**
   * Заявки в статусе pending — «ожидают одобрения».
   */
  async getOfferPendingExecutors(
    offerId: string
  ): Promise<Array<{ user_id: string; initials: string }>> {
    const q = `
      SELECT oa.user_id, u.name, u.surname
      FROM offer_applications oa
      JOIN users u ON u.id = oa.user_id
      WHERE oa.offer_id = $1
        AND oa.status = 'pending'
      ORDER BY oa.applied_at ASC
    `;
    const r = await this.query(q, [offerId]);
    return (r.rows as Array<{ user_id: string; name: string; surname: string }>).map((row) => ({
      user_id: row.user_id,
      initials: userInitials(row.name, row.surname)
    }));
  }

  /**
   * Принятые по задаче (approved / in_progress), по которым ещё нет отчёта — «в работе».
   */
  async getOfferInWorkExecutors(
    offerId: string
  ): Promise<Array<{ user_id: string; initials: string }>> {
    const q = `
      SELECT oa.user_id, u.name, u.surname
      FROM offer_applications oa
      JOIN users u ON u.id = oa.user_id
      WHERE oa.offer_id = $1
        AND oa.status IN ('approved', 'in_progress')
        AND NOT EXISTS (SELECT 1 FROM offer_reports r WHERE r.application_id = oa.id)
      ORDER BY oa.approved_at NULLS LAST, oa.applied_at ASC
    `;
    const r = await this.query(q, [offerId]);
    return (r.rows as Array<{ user_id: string; name: string; surname: string }>).map((row) => ({
      user_id: row.user_id,
      initials: userInitials(row.name, row.surname)
    }));
  }

  /**
   * Исполнители, по которым уже есть отправленный отчёт по задаче (для кабинета заказчика).
   */
  async getOfferExecutorsWhoReported(
    offerId: string
  ): Promise<Array<{ user_id: string; initials: string }>> {
    const q = `
      SELECT r.user_id, u.name, u.surname
      FROM offer_reports r
      JOIN users u ON u.id = r.user_id
      WHERE r.offer_id = $1
      GROUP BY r.user_id, u.name, u.surname
      ORDER BY MAX(r.submitted_at) DESC
    `;
    const r = await this.query(q, [offerId]);
    return (r.rows as Array<{ user_id: string; name: string; surname: string }>).map((row) => ({
      user_id: row.user_id,
      initials: userInitials(row.name, row.surname)
    }));
  }

  /**
   * Публичный профиль исполнителя для заказчика (без PII), только если оффер принадлежит employer
   * и есть связь заявки/отчёта по этой задаче с исполнителем.
   */
  async getEmployerExecutorProfile(
    employerId: string,
    offerId: string,
    executorUserId: string
  ): Promise<{
    user_id: string;
    masked_name: string;
    executor_label: string;
    avatar_url: string | null;
    registered_at: string;
    executor_timezone: string | null;
    stats: {
      active_tasks_without_report: number;
      completed_tasks_with_report: number;
      executor_self_cancellations: number;
    };
    worked_with_this_employer: boolean;
  } | null> {
    const own = await this.query(
      'SELECT 1 FROM offers o WHERE o.id = $1 AND o.employer_id = $2',
      [offerId, employerId]
    );
    if (!own.rows.length) return null;

    const link = await this.query(
      `SELECT 1 FROM offer_applications oa WHERE oa.offer_id = $1 AND oa.user_id = $2
       UNION
       SELECT 1 FROM offer_reports r WHERE r.offer_id = $1 AND r.user_id = $2`,
      [offerId, executorUserId]
    );
    if (!link.rows.length) return null;

    const userRes = await this.query(
      `SELECT u.id, u.name, u.surname, u.role, u.created_at,
              i.url AS avatar_url
       FROM users u
       LEFT JOIN images i ON i.is_active = TRUE
         AND u.avatar_id IS NOT NULL
         AND TRIM(u.avatar_id) <> ''
         AND i.id::text = TRIM(u.avatar_id)
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [executorUserId]
    );
    if (!userRes.rows.length) return null;
    const row = userRes.rows[0] as {
      id: string;
      name: string;
      surname: string;
      role: string;
      created_at: string;
      avatar_url: string | null;
    };
    if (row.role !== 'user') return null;

    const suffixRes = await this.query(
      'SELECT RIGHT(REPLACE($1::text, \'-\', \'\'), 4) AS suf',
      [executorUserId]
    );
    const suf = String(suffixRes.rows[0]?.suf ?? '').trim();

    const masked_name = formatExecutorDottedInitials(row.name, row.surname);
    const executor_label = formatExecutorMaskLabel(suf, row.name, row.surname);

    const [
      activeR,
      completedR,
      cancelR,
      workedR
    ] = await Promise.all([
      this.query(
        `SELECT COUNT(*)::int AS c FROM offer_applications oa
         WHERE oa.user_id = $1
           AND oa.status IN ('approved', 'in_progress')
           AND NOT EXISTS (SELECT 1 FROM offer_reports r WHERE r.application_id = oa.id)`,
        [executorUserId]
      ),
      this.query(
        'SELECT COUNT(DISTINCT r.offer_id)::int AS c FROM offer_reports r WHERE r.user_id = $1',
        [executorUserId]
      ),
      this.query(
        `SELECT COUNT(DISTINCT oa.offer_id)::int AS c FROM offer_applications oa
         WHERE oa.user_id = $1
           AND oa.status = 'cancelled'
           AND (
             oa.application_text IS NULL
             OR oa.application_text NOT LIKE '%Задача закрыта заказчиком.%'
           )`,
        [executorUserId]
      ),
      this.query(
        `SELECT EXISTS (
           SELECT 1 FROM offer_reports r
           INNER JOIN offers o ON o.id = r.offer_id
           WHERE r.user_id = $1 AND o.employer_id = $2
         ) AS e`,
        [executorUserId, employerId]
      )
    ]);

    const createdRaw = row.created_at as Date | string | null;
    const registered_at =
      createdRaw instanceof Date
        ? createdRaw.toISOString()
        : createdRaw != null
          ? String(createdRaw)
          : '';

    return {
      user_id: row.id,
      masked_name,
      executor_label,
      avatar_url: row.avatar_url ?? null,
      registered_at,
      executor_timezone: null,
      stats: {
        active_tasks_without_report: Number(activeR.rows[0]?.c ?? 0),
        completed_tasks_with_report: Number(completedR.rows[0]?.c ?? 0),
        executor_self_cancellations: Number(cancelR.rows[0]?.c ?? 0)
      },
      worked_with_this_employer: Boolean(workedR.rows[0]?.e)
    };
  }

  /** Число занятых мест (по тем же статусам, что и current_participants на оффере). */
  async getOccupiedSlotsCount(offerId: string): Promise<number> {
    const r = await this.query(
      `SELECT COUNT(*)::int AS c FROM offer_applications
       WHERE offer_id = $1 AND status IN ('approved', 'in_progress', 'completed')`,
      [offerId]
    );
    return Number(r.rows[0]?.c ?? 0);
  }

  /** Есть ли свободное место; лимит «без ограничения» — значение 999 в БД. */
  async offerHasFreeSlot(offerId: string): Promise<boolean> {
    const r = await this.query('SELECT max_participants FROM offers WHERE id = $1', [offerId]);
    const max = r.rows[0]?.max_participants;
    if (max == null) return true;
    if (Number(max) === MAX_PARTICIPANTS_UNLIMITED) return true;
    const cnt = await this.getOccupiedSlotsCount(offerId);
    return cnt < Number(max);
  }

  // Получить заказчика по ID
  async getEmployerById(id: string): Promise<any | null> {
    const query = `
      SELECT * FROM employers WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  // Получить изображение по ID
  async getImageById(id: string): Promise<any | null> {
    const query = `
      SELECT * FROM images WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  // Получить баннер
  async getBanner(): Promise<any | null> {
    const query = `
      SELECT 
        b.*,
        i.url as image_url,
        i.alt_text as image_alt_text
      FROM banners b
      JOIN images i ON b.image_id = i.id
      WHERE b.is_active = TRUE 
        AND i.is_active = TRUE
      ORDER BY b.display_order ASC
      LIMIT 1
    `;
    
    const result = await this.query(query);
    return result.rows[0] || null;
  }

  // Получить предложения с фильтрацией
  async getOffersWithFilters(filters: {
    isFavourite?: boolean;
    isPromo?: boolean;
    authorId?: string;
    active?: boolean;
    viewerUserId?: string;
  }): Promise<any[]> {
    let query = `
      SELECT 
        o.*,
        ${OCCUPIED_SLOTS_EXPR} as current_participants,
        u.name as employer_name,
        u.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        ${AVAILABLE_SLOTS_EXPR} as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    if (filters.isPromo !== undefined) {
      paramCount++;
      query += ` AND o.is_promo = $${paramCount}`;
      params.push(filters.isPromo);
    }

    if (filters.authorId) {
      paramCount++;
      query += ` AND o.employer_id = $${paramCount}`;
      params.push(filters.authorId);
    }

    if (filters.active !== false) {
      // Для активной выдачи скрываем офферы без свободных мест,
      // но если пользователь уже участвовал (есть заявка), показываем всё равно
      const userId = filters.viewerUserId;
      query += ` AND o.is_active = TRUE 
                   AND o.start_date <= NOW() 
                   AND o.end_date >= NOW()
                   AND e.is_active = TRUE
                   AND (
                     (${AVAILABLE_SLOTS_EXPR} IS NULL OR ${AVAILABLE_SLOTS_EXPR} > 0)
                     ${userId ? ` OR EXISTS (
                       SELECT 1 FROM offer_applications oa_me
                       WHERE oa_me.offer_id = o.id AND oa_me.user_id = $${paramCount + 1}
                     )` : ''}
                   )`;
      if (userId) {
        paramCount++;
        params.push(userId);
      }
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await this.query(query, params);
    return result.rows.map((row: { tags?: unknown }) => ({ ...row, tags: normalizeTags(row.tags) }));
  }

  // Обновить счетчик участников в предложении
  async updateOfferParticipants(offerId: string): Promise<void> {
    const query = `
      UPDATE offers 
      SET current_participants = (
        SELECT COUNT(*) 
        FROM offer_applications 
        WHERE offer_id = $1 
        AND status IN ('approved', 'in_progress', 'completed')
      )
      WHERE id = $1
    `;
    
    await this.query(query, [offerId]);
  }

  // Проверить существование пользователя
  async isUserExists(userId: string): Promise<boolean> {
    const query = `
      SELECT id FROM users 
      WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await this.query(query, [userId]);
    return result.rows.length > 0;
  }

  // Получить статистику пользователя
  async getUserStatistics(userId: string): Promise<any | null> {
    const query = `
      SELECT 
        us.user_id,
        us.name,
        us.surname,
        u.email,
        u.phone,
        us.total_applications,
        us.approved_applications,
        us.in_progress_applications,
        us.completed_applications,
        us.total_earnings,
        us.average_rating,
        us.favourite_offers_count
      FROM user_statistics us
      JOIN users u ON us.user_id = u.id
      WHERE us.user_id = $1
    `;
    
    const result = await this.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Получить пользователя по email (включая password_hash и role для проверки)
  async getUserByEmail(email: string): Promise<any | null> {
    const query = `
      SELECT 
        id,
        email,
        password_hash,
        phone,
        name,
        surname,
        is_active,
        role
      FROM users
      WHERE email = $1
    `;
    
    const result = await this.query(query, [email]);
    return result.rows[0] || null;
  }

  // Получить пользователя по id (для проверки роли по БД, не по JWT)
  async getUserById(userId: string): Promise<{ id: string; role: string; is_active: boolean } | null> {
    const query = 'SELECT id, role, is_active FROM users WHERE id = $1';
    const result = await this.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Проверить существование email
  async isEmailExists(email: string): Promise<boolean> {
    const query = `
      SELECT id FROM users 
      WHERE email = $1
    `;
    
    const result = await this.query(query, [email]);
    return result.rows.length > 0;
  }

  // Проверить существование телефона
  async isPhoneExists(phone: string): Promise<boolean> {
    const query = `
      SELECT id FROM users 
      WHERE phone = $1
    `;
    
    const result = await this.query(query, [phone]);
    return result.rows.length > 0;
  }

  // Создать нового пользователя (role по умолчанию 'user')
  async createUser(userData: {
    email: string;
    password: string;
    phone: string;
    name: string;
    lastname: string;
    role?: string;
  }): Promise<any> {
    const role = userData.role === 'employer' ? 'employer' : 'user';
    const query = `
      INSERT INTO users (email, password_hash, phone, name, surname, is_active, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
      RETURNING id, email, phone, name, surname, role, created_at
    `;
    
    const result = await this.query(query, [
      userData.email,
      userData.password,
      userData.phone,
      userData.name,
      userData.lastname,
      role
    ]);

    return {
      id: result.rows[0].id,
      email: result.rows[0].email,
      phone: result.rows[0].phone,
      name: result.rows[0].name,
      lastname: result.rows[0].surname,
      role: result.rows[0].role || 'user',
      createdAt: result.rows[0].created_at
    };
  }

  // Создать запись заказчика (employer): только user_id и доп. данные. Имя, контакты, логин — в users.
  async createEmployer(data: { user_id: string; company: string; description?: string; website?: string }): Promise<any> {
    const query = `
      INSERT INTO employers (user_id, company, description, website, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
      RETURNING id, user_id, company, description, website, created_at, updated_at
    `;
    const result = await this.query(query, [
      data.user_id,
      data.company,
      data.description || null,
      data.website || null
    ]);
    return result.rows[0];
  }

  // Получить employer по user_id (связь: employers.user_id → users.id)
  async getEmployerByUserId(userId: string): Promise<any | null> {
    const query = 'SELECT * FROM employers WHERE user_id = $1 AND is_active = TRUE';
    const result = await this.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Получить employer_id по user_id (для проверки владельца оффера)
  async getEmployerIdByUserId(userId: string): Promise<string | null> {
    const emp = await this.getEmployerByUserId(userId);
    return emp ? emp.id : null;
  }

  // Офферы текущего заказчика (для GET /api/my/offers)
  async getOffersByEmployerId(employerId: string, options?: { page?: number; limit?: number }): Promise<{ rows: any[]; total: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*)::int FROM offers WHERE employer_id = $1';
    const countResult = await this.query(countQuery, [employerId]);
    const total = countResult.rows[0]?.count ?? 0;

    const query = `
      SELECT 
        o.*,
        ${OCCUPIED_SLOTS_EXPR} as current_participants,
        u.name as employer_name,
        u.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        ${AVAILABLE_SLOTS_EXPR} as available_slots,
        NOT (
          EXISTS (SELECT 1 FROM offer_reports r WHERE r.offer_id = o.id)
          OR EXISTS (
            SELECT 1 FROM offer_applications oa
            WHERE oa.offer_id = o.id
              AND oa.status IN ('approved', 'in_progress', 'completed')
          )
        ) AS can_edit
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.employer_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.query(query, [employerId, limit, offset]);
    const rows = result.rows.map((row: { tags?: unknown }) => ({ ...row, tags: normalizeTags(row.tags) }));
    return { rows, total };
  }

  // Создать оффер (employer_id из JWT)
  async createOffer(data: {
    employer_id: string;
    title: string;
    description?: string;
    price?: number;
    location?: string;
    requirements?: string;
    tags?: string[];
    start_date: Date;
    end_date: Date;
    max_participants: number;
    is_promo?: boolean;
    image_id?: string;
    numeric_info?: number;
    checklist_schema?: unknown | null;
    schema_version?: number;
  }): Promise<any> {
    const tagsJson = Array.isArray(data.tags) ? JSON.stringify(data.tags) : '[]';
    const query = `
      INSERT INTO offers (
        employer_id, title, description, price, location, requirements, tags,
        start_date, end_date, max_participants, current_participants, is_promo, image_id, numeric_info, is_active, created_at, updated_at,
        checklist_schema, schema_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, 0, $11, $12, $13, TRUE, NOW(), NOW(), $14::jsonb, $15)
      RETURNING *
    `;
    const price = data.price != null && !Number.isNaN(Number(data.price)) ? Number(data.price) : 0;
    const checklistJson =
      data.checklist_schema !== undefined && data.checklist_schema !== null
        ? JSON.stringify(data.checklist_schema)
        : null;
    const schemaVer =
      typeof data.schema_version === 'number' && !Number.isNaN(data.schema_version) ? data.schema_version : 1;
    const result = await this.query(query, [
      data.employer_id,
      data.title,
      data.description || null,
      price,
      data.location || null,
      data.requirements || null,
      tagsJson,
      data.start_date,
      data.end_date,
      data.max_participants,
      data.is_promo ?? false,
      data.image_id || null,
      data.numeric_info ?? price,
      checklistJson,
      schemaVer
    ]);
    const row = result.rows[0];
    return row ? { ...row, tags: normalizeTags(row.tags) } : row;
  }

  async verifyApplicationForUser(
    applicationId: string,
    userId: string,
    offerId: string
  ): Promise<boolean> {
    const q = `
      SELECT 1 FROM offer_applications
      WHERE id = $1 AND user_id = $2 AND offer_id = $3
      LIMIT 1
    `;
    const r = await this.query(q, [applicationId, userId, offerId]);
    return r.rows.length > 0;
  }

  // Обновить оффер (частично)
  async updateOffer(offerId: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    location: string;
    requirements: string;
    tags: string[];
    start_date: Date;
    end_date: Date;
    max_participants: number;
    is_promo: boolean;
    is_active: boolean;
    checklist_schema: unknown | null;
    schema_version: number;
  }>): Promise<any | null> {
    const allowed = [
      'title', 'description', 'price', 'location', 'requirements', 'tags',
      'start_date', 'end_date', 'max_participants', 'is_promo', 'is_active',
      'checklist_schema', 'schema_version'
    ];
    const updates: string[] = [];
    const values: any[] = [];
    let i = 0;
    for (const [key, value] of Object.entries(data)) {
      if (!allowed.includes(key) || value === undefined) continue;
      i++;
      if (key === 'tags') {
        updates.push(`tags = $${i}::jsonb`);
        values.push(JSON.stringify(value));
      } else if (key === 'checklist_schema') {
        updates.push(`checklist_schema = $${i}::jsonb`);
        values.push(value === null ? null : JSON.stringify(value));
      } else if (key === 'start_date' || key === 'end_date') {
        updates.push(`${key} = $${i}`);
        values.push(value);
      } else {
        updates.push(`${key} = $${i}`);
        values.push(value);
      }
    }
    if (updates.length === 0) return this.getOfferById(offerId);
    updates.push('updated_at = NOW()');
    i++;
    values.push(offerId);
    const query = `UPDATE offers SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
    const result = await this.query(query, values);
    if (result.rows.length === 0) return null;
    return this.getOfferById(offerId);
  }

  // Проверить, что оффер принадлежит employer_id
  async isOfferOwnedByEmployer(offerId: string, employerId: string): Promise<boolean> {
    const query = 'SELECT id FROM offers WHERE id = $1 AND employer_id = $2';
    const result = await this.query(query, [offerId, employerId]);
    return result.rows.length > 0;
  }

  /** Отчёты по офферу для заказчика (без PII исполнителя) */
  async getEmployerOfferReports(
    employerId: string,
    offerId: string,
    sortBy: 'submitted_at' | 'task_completed_at'
  ): Promise<any[]> {
    const orderSql =
      sortBy === 'task_completed_at'
        ? 'oa.completed_at DESC NULLS LAST, r.submitted_at DESC'
        : 'r.submitted_at DESC';
    const query = `
      SELECT
        r.id,
        r.user_id AS executor_user_id,
        r.submitted_at,
        oa.completed_at AS task_completed_at,
        r.rating,
        r.comments,
        r.feedback,
        r.checklist_answers,
        r.checklist_schema_version,
        r.checklist_schema_snapshot,
        r.photos,
        RIGHT(REPLACE(r.user_id::text, '-', ''), 4) AS executor_suffix,
        u_ex.name AS executor_name,
        u_ex.surname AS executor_surname
      FROM offer_reports r
      JOIN offers o ON o.id = r.offer_id
      JOIN offer_applications oa ON oa.id = r.application_id
      JOIN users u_ex ON u_ex.id = r.user_id
      WHERE r.offer_id = $1 AND o.employer_id = $2
      ORDER BY ${orderSql}
    `;
    const result = await this.query(query, [offerId, employerId]);
    return result.rows.map(
      (row: {
        executor_suffix: string;
        executor_name?: string;
        executor_surname?: string;
        [key: string]: unknown;
      }) => {
        const { executor_name, executor_surname, executor_suffix, ...rest } = row;
        return {
          ...rest,
          executor_label: formatExecutorMaskLabel(
            String(executor_suffix ?? ''),
            executor_name,
            executor_surname
          )
        };
      }
    );
  }

  async getEmployerOfferReportById(
    employerId: string,
    offerId: string,
    reportId: string
  ): Promise<any | null> {
    const query = `
      SELECT
        r.id,
        r.user_id AS executor_user_id,
        r.submitted_at,
        oa.completed_at AS task_completed_at,
        r.rating,
        r.comments,
        r.feedback,
        r.checklist_answers,
        r.checklist_schema_version,
        r.checklist_schema_snapshot,
        r.photos,
        RIGHT(REPLACE(r.user_id::text, '-', ''), 4) AS executor_suffix,
        u_ex.name AS executor_name,
        u_ex.surname AS executor_surname
      FROM offer_reports r
      JOIN offers o ON o.id = r.offer_id
      JOIN offer_applications oa ON oa.id = r.application_id
      JOIN users u_ex ON u_ex.id = r.user_id
      WHERE r.id = $1 AND r.offer_id = $2 AND o.employer_id = $3
    `;
    const result = await this.query(query, [reportId, offerId, employerId]);
    const row = result.rows[0];
    if (!row) return null;
    const {
      executor_name,
      executor_surname,
      executor_suffix,
      ...rest
    } = row as {
      executor_name?: string;
      executor_surname?: string;
      executor_suffix: string;
      [key: string]: unknown;
    };
    return {
      ...rest,
      executor_label: formatExecutorMaskLabel(String(executor_suffix ?? ''), executor_name, executor_surname)
    };
  }

  /** Собственный отчёт исполнителя по задаче (один на заявку) */
  async getExecutorOwnReport(userId: string, offerId: string): Promise<any | null> {
    const query = `
      SELECT
        r.id,
        r.submitted_at,
        oa.completed_at AS task_completed_at,
        r.rating,
        r.comments,
        r.feedback,
        r.checklist_answers,
        r.checklist_schema_version,
        r.checklist_schema_snapshot,
        r.photos
      FROM offer_reports r
      JOIN offer_applications oa ON oa.id = r.application_id
      WHERE r.offer_id = $1 AND r.user_id = $2
      LIMIT 1
    `;
    const result = await this.query(query, [offerId, userId]);
    return result.rows[0] ?? null;
  }

  /**
   * Досрочное закрытие задачи заказчиком: деактивация оффера (is_active = false),
   * заявки в pending → cancelled с пояснением. Идемпотентно, если задача уже неактивна.
   */
  async closeOfferEarlyForEmployer(
    offerId: string,
    employerId: string
  ): Promise<
    | { status: 'ok'; offer: any }
    | { status: 'already_closed'; offer: any }
    | { status: 'not_found' }
    | { status: 'already_ended' }
  > {
    const pendingCancelReason = 'Задача закрыта заказчиком.';
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const sel = await client.query(
        'SELECT id, employer_id, is_active, end_date FROM offers WHERE id = $1 FOR UPDATE',
        [offerId]
      );
      if (sel.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      const row = sel.rows[0] as {
        employer_id: string;
        is_active: boolean;
        end_date: Date;
      };
      if (row.employer_id !== employerId) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      if (!row.is_active) {
        await client.query('ROLLBACK');
        const offer = await this.getOfferById(offerId);
        return { status: 'already_closed', offer: offer ?? null };
      }
      const end = row.end_date instanceof Date ? row.end_date : new Date(row.end_date);
      if (end < new Date()) {
        await client.query('ROLLBACK');
        return { status: 'already_ended' };
      }

      await client.query(
        `UPDATE offer_applications
         SET status = 'cancelled',
             application_text = CASE
               WHEN application_text IS NOT NULL AND TRIM(application_text) <> ''
               THEN application_text || E'\n' || $2
               ELSE $2
             END
         WHERE offer_id = $1 AND status = 'pending'`,
        [offerId, pendingCancelReason]
      );

      await client.query(
        'UPDATE offers SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
        [offerId]
      );

      await client.query('COMMIT');
      const offer = await this.getOfferById(offerId);
      return { status: 'ok', offer: offer ?? null };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  // Удалить оффер (или мягкое удаление — is_active = false)
  async deleteOffer(offerId: string, soft: boolean = true): Promise<boolean> {
    if (soft) {
      const result = await this.query(
        'UPDATE offers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
        [offerId]
      );
      return result.rows.length > 0;
    }
    const result = await this.query('DELETE FROM offers WHERE id = $1 RETURNING id', [offerId]);
    return result.rows.length > 0;
  }
}

export const dbService = new DatabaseService();

