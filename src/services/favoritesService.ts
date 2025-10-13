import { Pool } from 'pg';
import pool from '../config/database';
import { FavoriteOffer } from '../types';

export class FavoritesService {
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

  // Получить избранные предложения пользователя
  async getUserFavorites(userId: string): Promise<FavoriteOffer[]> {
    const query = `
      SELECT 
        o.id,
        CASE 
          WHEN (o.max_participants - o.current_participants) > 0 
          THEN true 
          ELSE false 
        END as available,
        o.title,
        o.description,
        o.price,
        o.location,
        i.alt_text as image_alt_text,
        o.is_promo,
        o.start_date::text,
        o.end_date::text,
        e.company as employer_company
      FROM favourites f
      JOIN offers o ON f.offer_id = o.id
      JOIN employers e ON o.employer_id = e.id
      LEFT JOIN images i ON o.image_id = i.id
      WHERE f.user_id = $1
        AND o.is_active = TRUE
        AND e.is_active = TRUE
      ORDER BY f.created_at DESC
    `;
    
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  // Добавить предложение в избранное
  async addToFavorites(userId: string, offerId: string): Promise<{ added: boolean; message: string }> {
    // Сначала проверим, существует ли предложение
    const offerExists = await this.isOfferExists(offerId);
    if (!offerExists) {
      throw new Error('OFFER_NOT_FOUND');
    }

    // Проверим, есть ли уже в избранном
    const checkQuery = `
      SELECT id FROM favourites 
      WHERE user_id = $1 AND offer_id = $2
    `;
    const checkResult = await this.query(checkQuery, [userId, offerId]);
    
    if (checkResult.rows.length > 0) {
      return { added: false, message: 'Уже в избранном' };
    }

    // Добавляем в избранное
    const insertQuery = `
      INSERT INTO favourites (user_id, offer_id, created_at)
      VALUES ($1, $2, NOW())
    `;
    await this.query(insertQuery, [userId, offerId]);
    
    return { added: true, message: 'Добавлено в избранное' };
  }

  // Удалить предложение из избранного
  async removeFromFavorites(userId: string, offerId: string): Promise<{ removed: boolean; message: string }> {
    const query = `
      DELETE FROM favourites 
      WHERE user_id = $1 AND offer_id = $2
    `;
    
    const result = await this.query(query, [userId, offerId]);
    
    if (result.rowCount === 0) {
      return { removed: false, message: 'Не было в избранном' };
    }
    
    return { removed: true, message: 'Удалено из избранного' };
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
}

export const favoritesService = new FavoritesService();
