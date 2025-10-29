import { Pool } from 'pg';
import pool from '../config/database';

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

  // Получить все активные предложения
  async getActiveOffers(): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        e.name as employer_name,
        e.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        (o.max_participants - o.current_participants) as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.is_active = TRUE 
        AND o.start_date <= NOW() 
        AND o.end_date >= NOW()
        AND e.is_active = TRUE
      ORDER BY o.created_at DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }

  // Получить промо-предложения
  async getPromoOffers(): Promise<any[]> {
    const query = `
      SELECT 
        o.*,
        e.name as employer_name,
        e.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        (o.max_participants - o.current_participants) as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.is_promo = TRUE 
        AND o.is_active = TRUE 
        AND o.start_date <= NOW() 
        AND o.end_date >= NOW()
        AND e.is_active = TRUE
      ORDER BY o.created_at DESC
    `;
    
    const result = await this.query(query);
    return result.rows;
  }

  // Получить предложение по ID
  async getOfferById(id: string): Promise<any | null> {
    const query = `
      SELECT 
        o.*,
        e.name as employer_name,
        e.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        (o.max_participants - o.current_participants) as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE o.id = $1
    `;
    
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
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
  }): Promise<any[]> {
    let query = `
      SELECT 
        o.*,
        e.name as employer_name,
        e.surname as employer_surname,
        e.company as employer_company,
        i.url as image_url,
        i.alt_text as image_alt_text,
        (o.max_participants - o.current_participants) as available_slots
      FROM offers o
      JOIN employers e ON o.employer_id = e.id
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
      query += ` AND o.is_active = TRUE 
                   AND o.start_date <= NOW() 
                   AND o.end_date >= NOW()
                   AND e.is_active = TRUE`;
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await this.query(query, params);
    return result.rows;
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
}

export const dbService = new DatabaseService();

