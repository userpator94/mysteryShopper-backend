import { Pool } from 'pg';
import pool from '../config/database';
import {
  parseChecklistSchema,
  validateAnswersAgainstSchema,
  type ChecklistSchema
} from '../utils/checklistSchemaValidator';
import { rewardsService } from './rewardsService';

export class ReportService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  private async queryWithClient(client: any, text: string, params?: any[]): Promise<any> {
    return client.query(text, params);
  }

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
        filename, original_name, mime_type, type, size, url, report_file, alt_text, is_active, created_at
      )
      VALUES ($1, $2, $3, 'report', $4, '', $5, $6, TRUE, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const result = await this.queryWithClient(client, query, [
      filename,
      originalName,
      mimeType,
      size,
      binaryData,
      altText || null
    ]);
    if (result.rows.length === 0) throw new Error('Ошибка при создании изображения');
    return result.rows[0].id;
  }

  /**
   * Создание отчёта: стандартный (рейтинг + текст) или ответы по чек-листу.
   */
  /**
   * Проверка согласованности файлов с пунктами photo_text и обязательных полей.
   */
  private validatePhotoTextLinkage(
    schema: ChecklistSchema,
    answers: Record<string, unknown>,
    photoItemIds: string[],
    fileCount: number
  ): void {
    if (fileCount !== photoItemIds.length) {
      throw new Error(
        'VALIDATION:Число загруженных файлов не совпадает со списком checklist_photo_item_ids'
      );
    }
    const seen = new Set<string>();
    for (const id of photoItemIds) {
      if (seen.has(id)) {
        throw new Error('VALIDATION:В checklist_photo_item_ids повторяется id пункта');
      }
      seen.add(id);
      const item = schema.items.find((i) => i.id === id);
      if (!item || item.type !== 'photo_text') {
        throw new Error('VALIDATION:Файл привязан к недопустимому пункту чек-листа');
      }
      if (answers[id] === undefined) {
        throw new Error('VALIDATION:Нет текстового ответа для пункта с фото');
      }
    }

    for (const item of schema.items) {
      if (item.type !== 'photo_text') continue;
      const hasAns = answers[item.id] !== undefined;
      const hasFile = photoItemIds.includes(item.id);
      if (item.required) {
        if (!hasAns || !hasFile) {
          throw new Error(
            `VALIDATION:Для пункта «${item.label}» требуются фото и пояснение`
          );
        }
      } else if (hasAns !== hasFile) {
        throw new Error(
          `VALIDATION:Для пункта «${item.label}» укажите и фото, и пояснение или оставьте пункт пустым`
        );
      }
    }
  }

  async createReport(params: {
    applicationId: string;
    offerId: string;
    userId: string;
    rating: number | null;
    commentsText: string | null;
    checklistAnswers: Record<string, unknown> | null;
    /** Id пунктов photo_text в том же порядке, что и файлы в photoFiles */
    checklistPhotoItemIds: string[] | null;
    photoFiles: Array<{
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }>;
  }): Promise<{
    report_id: string;
    application_id: string;
    offer_id: string;
    user_id: string;
    rating: number | null;
    feedback: unknown;
    photos: string[];
    submitted_at: Date;
  }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const dup = await this.queryWithClient(
        client,
        'SELECT id FROM offer_reports WHERE application_id = $1 LIMIT 1',
        [params.applicationId]
      );
      if (dup.rows.length > 0) {
        throw new Error('REPORT_ALREADY_EXISTS');
      }

      const appRes = await this.queryWithClient(
        client,
        `SELECT oa.status::text AS status, o.end_date
         FROM offer_applications oa
         JOIN offers o ON o.id = oa.offer_id
         WHERE oa.id = $1 AND oa.user_id = $2 AND oa.offer_id = $3`,
        [params.applicationId, params.userId, params.offerId]
      );
      if (appRes.rows.length === 0) {
        throw new Error('APPLICATION_NOT_FOUND');
      }
      const appStatus = String(appRes.rows[0].status || '').toLowerCase();
      if (appStatus !== 'approved' && appStatus !== 'in_progress') {
        throw new Error('APPLICATION_NOT_ELIGIBLE_FOR_REPORT');
      }
      const endDate = appRes.rows[0].end_date as Date;
      if (endDate && new Date(endDate) < new Date()) {
        throw new Error('REPORT_DEADLINE_PASSED');
      }

      const offerRes = await this.queryWithClient(
        client,
        'SELECT employer_id, checklist_schema, schema_version, price FROM offers WHERE id = $1',
        [params.offerId]
      );
      if (offerRes.rows.length === 0) {
        throw new Error('OFFER_NOT_FOUND');
      }
      const employerId = offerRes.rows[0].employer_id as string;
      const rawSchema = offerRes.rows[0].checklist_schema;
      const schemaVersion = Number(offerRes.rows[0].schema_version) || 1;
      const offerPriceRaw = offerRes.rows[0].price;

      const parsed = parseChecklistSchema(rawSchema);
      if (!parsed.ok) {
        throw new Error(`SCHEMA_ERROR:${parsed.message}`);
      }
      const hasCustomSchema = parsed.schema !== null;

      let rating: number | null = params.rating;
      let comments: string | null = params.commentsText;
      let feedbackJson: string;
      let checklistAnswersJson: string | null = null;
      let checklistSnapshotJson: string | null = null;
      let checklistVer: number | null = null;
      const photoIds: string[] = [];

      if (hasCustomSchema && parsed.schema) {
        if (!params.checklistAnswers) {
          throw new Error('CHECKLIST_ANSWERS_REQUIRED');
        }
        const v = validateAnswersAgainstSchema(parsed.schema, params.checklistAnswers);
        if (!v.ok) {
          throw new Error(`VALIDATION:${v.message}:${v.field || ''}`);
        }
        rating = null;
        comments = null;
        const photoItemIds = params.checklistPhotoItemIds ?? [];
        this.validatePhotoTextLinkage(
          parsed.schema,
          v.answers as Record<string, unknown>,
          photoItemIds,
          params.photoFiles.length
        );

        const mergedAnswers: Record<string, unknown> = { ...(v.answers as Record<string, unknown>) };
        for (let i = 0; i < params.photoFiles.length; i++) {
          const file = params.photoFiles[i];
          const itemId = photoItemIds[i];
          const imageId = await this.createImageWithClient(
            client,
            file.filename,
            file.originalname,
            file.mimetype,
            file.size,
            file.buffer
          );
          photoIds.push(imageId);
          const base = mergedAnswers[itemId];
          const baseObj =
            typeof base === 'object' && base !== null && !Array.isArray(base)
              ? (base as Record<string, unknown>)
              : {};
          mergedAnswers[itemId] = {
            ...baseObj,
            photo_url: `/api/images/${imageId}`
          };
        }

        checklistAnswersJson = JSON.stringify(mergedAnswers);
        checklistSnapshotJson = JSON.stringify(parsed.schema);
        checklistVer = schemaVersion;
        feedbackJson = JSON.stringify({ mode: 'checklist' });
      } else {
        if (rating === null || rating < 1 || rating > 5) {
          throw new Error('RATING_REQUIRED');
        }
        const text = (params.commentsText || '').trim();
        if (!text) {
          throw new Error('COMMENT_REQUIRED');
        }
        comments = text;
        feedbackJson = JSON.stringify({ comment: text, mode: 'standard' });
        if (params.checklistPhotoItemIds && params.checklistPhotoItemIds.length > 0) {
          throw new Error('VALIDATION:Поле checklist_photo_item_ids допустимо только для отчёта с чек-листом');
        }
        for (const file of params.photoFiles) {
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
      }

      const reportQuery = `
        INSERT INTO offer_reports (
          application_id,
          offer_id,
          user_id,
          employer_id,
          rating,
          comments,
          feedback,
          photos,
          checklist_answers,
          checklist_schema_version,
          checklist_schema_snapshot,
          submitted_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5,
          $6,
          $7,
          $8::json,
          $9::jsonb,
          $10,
          $11::jsonb,
          CURRENT_TIMESTAMP
        )
        RETURNING 
          id as report_id,
          application_id,
          offer_id,
          user_id,
          rating,
          comments,
          feedback,
          photos,
          checklist_answers,
          submitted_at
      `;

      const reportResult = await client.query(reportQuery, [
        params.applicationId,
        params.offerId,
        params.userId,
        employerId,
        rating,
        comments,
        feedbackJson,
        JSON.stringify(photoIds),
        checklistAnswersJson,
        checklistVer,
        checklistSnapshotJson
      ]);

      if (reportResult.rows.length === 0) {
        throw new Error('Ошибка при создании отчета');
      }

      // Начисляем вознаграждение: пока считаем авто-принятие при создании отчёта.
      // amount = вознаграждение оффера (в бонусах) — 1:1
      const priceNum = typeof offerPriceRaw === 'string' ? parseFloat(offerPriceRaw) : Number(offerPriceRaw);
      const amount = Number.isFinite(priceNum) ? Math.max(0, Math.round(priceNum)) : 0;
      await rewardsService.creditForReport({
        userId: params.userId,
        offerId: params.offerId,
        applicationId: params.applicationId,
        reportId: reportResult.rows[0].report_id,
        amount,
        kind: 'bonus',
        description: null,
        client
      });

      await client.query('COMMIT');
      const row = reportResult.rows[0];
      return {
        report_id: row.report_id,
        application_id: row.application_id,
        offer_id: row.offer_id,
        user_id: row.user_id,
        rating: row.rating,
        feedback: row.feedback,
        photos: row.photos || [],
        submitted_at: row.submitted_at
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const reportService = new ReportService();
