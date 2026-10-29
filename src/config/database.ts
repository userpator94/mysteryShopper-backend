import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'msDB',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // максимальное количество соединений в пуле
  idleTimeoutMillis: 30000, // время ожидания перед закрытием неактивного соединения
  connectionTimeoutMillis: 2000, // время ожидания подключения
  statement_timeout: 10000, // прерывать запросы к БД, которые выполняются дольше 10с
  query_timeout: 10000, // таймаут на стороне клиента pg для отдельного запроса
};

// Создаем пул соединений
export const pool = new Pool(dbConfig);

// Обработка ошибок пула
pool.on('error', (err) => {
  logger.fatal({ err }, 'Unexpected error on idle database client');
  process.exit(-1);
});

const dbTarget = (): string => `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

const connectionSuggestion = (code?: string): string | undefined => {
  if (code === 'ECONNREFUSED') return 'Make sure PostgreSQL is running and accessible';
  if (code === 'ENOTFOUND') return 'Check if the database host is correct';
  if (code === '28P01') return 'Check username and password';
  if (code === '3D000') return 'Check if the database exists';
  return undefined;
};

// Функция для тестирования подключения
export const testConnection = async (): Promise<boolean> => {
  logger.info({ event: 'db.connect', target: dbTarget() }, 'Testing database connection');

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    logger.info({
      event: 'db.connected',
      target: dbTarget(),
      serverTime: result.rows[0].current_time,
      postgresVersion: result.rows[0].postgres_version
    }, 'Database connected successfully');
    client.release();
    return true;
  } catch (err: any) {
    logger.error({
      event: 'db.connection_failed',
      target: dbTarget(),
      errorCode: err.code || 'UNKNOWN',
      suggestion: connectionSuggestion(err.code),
      err
    }, 'Database connection failed');
    return false;
  }
};

// Функция для закрытия пула соединений
export const closePool = async (): Promise<void> => {
  await pool.end();
};

export default pool;

