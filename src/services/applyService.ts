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

  // Создать заявку на предложение
  async createApplication(userId: string, offerId: string): Promise<any> {
    const query = `
      INSERT INTO offer_applications (
        offer_id,
        user_id,
        applied_at,
        approved_at,
        approved_by
      )
      VALUES (
        $1,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        '1416fac6-6954-4d49-a35c-684ead433361'
      )
      RETURNING 
        id as application_id,
        offer_id,
        user_id,
        applied_at,
        approved_at,
        approved_by
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
      approved_by: result.rows[0].approved_by || undefined
    };
  }
}

export const applyService = new ApplyService();

