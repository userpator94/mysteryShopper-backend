import { Pool } from 'pg';
import pool from '../config/database';

export class ReportService {
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

  // Метод для выполнения запросов с переданным клиентом (для транзакций)
  private async queryWithClient(client: any, text: string, params?: any[]): Promise<any> {
    const result = await client.query(text, params);
    return result;
  }

  // Создать изображение в таблице images (используется внутри транзакции)
  private async createImageWithClient(
    client: any,
    filename: string,
    originalName: string,
    mimeType: string,
    size: number,
    binaryData: Buffer,
    altText?: string
  ): Promise<string> {
    const query = `
      INSERT INTO images (
        filename,
        original_name,
        mime_type,
        type,
        size,
        report_file,
        alt_text,
        is_active,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'report',
        $4,
        $5,
        $6,
        TRUE,
        CURRENT_TIMESTAMP
      )
      RETURNING id
    `;
    
    const result = await this.queryWithClient(client, query, [
      filename,
      originalName,
      mimeType,
      size,
      binaryData, // BYTEA - бинарные данные
      altText || null
    ]);
    
    if (result.rows.length === 0) {
      throw new Error('Ошибка при создании изображения');
    }
    
    return result.rows[0].id;
  }

  // Создать отчет
  async createReport(
    applicationId: string,
    offerId: string,
    userId: string,
    rating: number,
    feedback: Record<string, any>,
    photoFiles: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }> = []
  ): Promise<any> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Сохраняем файлы в таблицу images и собираем их ID
      const photoIds: string[] = [];
      
      for (const file of photoFiles) {
        const imageId = await this.createImageWithClient(
          client,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          file.buffer
        );
        photoIds.push(imageId);
      }
      
      // Создаем отчет с массивом ID изображений
      const reportQuery = `
        INSERT INTO offer_reports (
          application_id,
          offer_id,
          user_id,
          rating,
          feedback,
          photos,
          submitted_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::json,
          CURRENT_TIMESTAMP
        )
        RETURNING 
          id as report_id,
          application_id,
          offer_id,
          user_id,
          rating,
          feedback,
          photos,
          submitted_at
      `;
      
      const reportResult = await client.query(reportQuery, [
        applicationId,
        offerId,
        userId,
        rating,
        JSON.stringify(feedback),
        JSON.stringify(photoIds) // Массив ID изображений (JSON, не JSONB)
      ]);
      
      if (reportResult.rows.length === 0) {
        throw new Error('Ошибка при создании отчета');
      }
      
      await client.query('COMMIT');
      
      const row = reportResult.rows[0];
      return {
        report_id: row.report_id,
        application_id: row.application_id,
        offer_id: row.offer_id,
        user_id: row.user_id,
        rating: row.rating,
        feedback: row.feedback,
        photos: row.photos || [], // Массив ID
        submitted_at: row.submitted_at
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const reportService = new ReportService();

