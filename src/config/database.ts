import { Pool, PoolConfig } from 'pg';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'msDB',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // максимальное количество соединений в пуле
  idleTimeoutMillis: 30000, // время ожидания перед закрытием неактивного соединения
  connectionTimeoutMillis: 2000, // время ожидания подключения
};

// Создаем пул соединений
export const pool = new Pool(dbConfig);

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Функция для тестирования подключения
export const testConnection = async (): Promise<boolean> => {
  console.log('🔍 Testing database connection...');
  console.log(`📊 Database config: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('✅ Database connected successfully!');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].postgres_version}`);
    client.release();
    return true;
  } catch (err: any) {
    console.error('❌ Database connection failed:');
    console.error(`   Error code: ${err.code || 'UNKNOWN'}`);
    console.error(`   Error message: ${err.message}`);
    console.error(`   Connection details: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('💡 Suggestion: Make sure PostgreSQL is running and accessible');
    } else if (err.code === 'ENOTFOUND') {
      console.error('💡 Suggestion: Check if the database host is correct');
    } else if (err.code === '28P01') {
      console.error('💡 Suggestion: Check username and password');
    } else if (err.code === '3D000') {
      console.error('💡 Suggestion: Check if the database exists');
    }
    
    return false;
  }
};

// Функция для закрытия пула соединений
export const closePool = async (): Promise<void> => {
  await pool.end();
};

export default pool;

