import { Pool } from 'pg';
import pool from '../config/database';

export class ApplyService {
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

  // Проверить существование предложения
  async isOfferExists(offerId: string): Promise<boolean> {
    const query = `
      SELECT id FROM offers 
      WHERE id = $1 AND is_active = TRUE
    `;
    
    const result = await this.query(query, [offerId]);
    return result.rows.length > 0;
  }

  // Создать заявку на предложение (ожидает решения заказчика)
  async createApplication(userId: string, offerId: string): Promise<any> {
    const query = `
      INSERT INTO offer_applications (
        offer_id,
        user_id,
        applied_at,
        approved_at,
        approved_by,
        status
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        NULL,
        NULL,
        'pending'
      )
      RETURNING 
        id as application_id,
        offer_id,
        user_id,
        applied_at,
        approved_at,
        status
    `;
    
    const result = await this.query(query, [offerId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Ошибка при создании заявки');
    }

    return {
      application_id: result.rows[0].application_id,
      offer_id: result.rows[0].offer_id,
      user_id: result.rows[0].user_id,
      applied_at: result.rows[0].applied_at,
      approved_at: result.rows[0].approved_at || undefined,
      status: result.rows[0].status ?? 'pending'
    };
  }

  // Получить все заявки пользователя (без cancelled)
  async getUserApplications(userId: string): Promise<any[]> {
    const query = `
      SELECT 
        oa.id as application_id,
        oa.offer_id,
        oa.user_id,
        oa.applied_at,
        oa.approved_at,
        oa.status,
        oa.employer_decision_comment,
        EXISTS (SELECT 1 FROM offer_reports r WHERE r.application_id = oa.id) AS has_report
      FROM offer_applications oa
      WHERE oa.user_id = $1 AND (oa.status IS NULL OR oa.status != 'cancelled')
      ORDER BY oa.applied_at DESC
    `;
    
    const result = await this.query(query, [userId]);
    return result.rows.map((row: any) => ({
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status || undefined,
      employer_decision_comment: row.employer_decision_comment || undefined,
      has_report: Boolean(row.has_report)
    }));
  }

  // Получить заявку пользователя по offer_id
  async getUserApplicationByOfferId(userId: string, offerId: string): Promise<any | null> {
    const query = `
      SELECT 
        oa.id as application_id,
        oa.offer_id,
        oa.user_id,
        oa.applied_at,
        oa.approved_at,
        oa.status,
        oa.employer_decision_comment,
        EXISTS (SELECT 1 FROM offer_reports r WHERE r.application_id = oa.id) AS has_report
      FROM offer_applications oa
      WHERE oa.user_id = $1 AND oa.offer_id = $2 AND (oa.status IS NULL OR oa.status != 'cancelled')
      ORDER BY oa.applied_at DESC
      LIMIT 1
    `;
    
    const result = await this.query(query, [userId, offerId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status || undefined,
      employer_decision_comment: row.employer_decision_comment || undefined,
      has_report: Boolean(row.has_report)
    };
  }

  // Отменить заявку (изменить статус на cancelled)
  async cancelApplication(userId: string, offerId: string): Promise<any | null> {
    const query = `
      UPDATE offer_applications
      SET status = 'cancelled'
      WHERE user_id = $1 AND offer_id = $2
      RETURNING 
        id as application_id,
        offer_id,
        user_id,
        applied_at,
        approved_at,
        status
    `;
    
    const result = await this.query(query, [userId, offerId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status || undefined
    };
  }

  // Список заявок по офферу (для владельца оффера — employer)
  async getApplicationsByOfferId(offerId: string): Promise<any[]> {
    const query = `
      SELECT 
        oa.id as application_id,
        oa.offer_id,
        oa.user_id,
        oa.applied_at,
        oa.approved_at,
        oa.status,
        oa.employer_decision_comment
      FROM offer_applications oa
      WHERE oa.offer_id = $1
      ORDER BY oa.applied_at DESC
    `;
    const result = await this.query(query, [offerId]);
    return result.rows.map((row: any) => ({
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status || undefined,
      employer_decision_comment: row.employer_decision_comment || undefined
    }));
  }

  // Получить заявку по id (для проверки владельца оффера)
  async getApplicationById(applicationId: string): Promise<{ offer_id: string; [key: string]: any } | null> {
    const query = `
      SELECT id as application_id, offer_id, user_id, applied_at, approved_at, status, employer_decision_comment
      FROM offer_applications WHERE id = $1
    `;
    const result = await this.query(query, [applicationId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status || undefined,
      employer_decision_comment: row.employer_decision_comment || undefined
    };
  }

  // Обновить статус заявки (approved | rejected) — вызывается после проверки прав владельца оффера
  async updateApplicationStatus(
    applicationId: string,
    status: 'approved' | 'rejected',
    opts?: { employerUserId?: string | null; decisionComment?: string | null }
  ): Promise<any | null> {
    if (status === 'approved') {
      const query = `
        UPDATE offer_applications
        SET status = 'approved',
            approved_at = CURRENT_TIMESTAMP,
            approved_by = $2,
            employer_decision_comment = NULL
        WHERE id = $1
        RETURNING id as application_id, offer_id, user_id, applied_at, approved_at, status, employer_decision_comment
      `;
      const result = await this.query(query, [applicationId, opts?.employerUserId ?? null]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        application_id: row.application_id,
        offer_id: row.offer_id,
        user_id: row.user_id,
        applied_at: row.applied_at,
        approved_at: row.approved_at || undefined,
        status: row.status,
        employer_decision_comment: row.employer_decision_comment || undefined
      };
    }

    const query = `
      UPDATE offer_applications
      SET status = 'rejected',
          approved_at = NULL,
          approved_by = NULL,
          employer_decision_comment = $2
      WHERE id = $1
      RETURNING id as application_id, offer_id, user_id, applied_at, approved_at, status, employer_decision_comment
    `;
    const result = await this.query(query, [applicationId, opts?.decisionComment ?? null]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      application_id: row.application_id,
      offer_id: row.offer_id,
      user_id: row.user_id,
      applied_at: row.applied_at,
      approved_at: row.approved_at || undefined,
      status: row.status,
      employer_decision_comment: row.employer_decision_comment || undefined
    };
  }
}

export const applyService = new ApplyService();
