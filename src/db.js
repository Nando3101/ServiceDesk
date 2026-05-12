import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sql = require('mssql/msnodesqlv8');

const connectionString =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=localhost\\SQLEXPRESS01;' +
  'Database=serviceDeskUTA;' +
  'Trusted_Connection=Yes;' +
  'TrustServerCertificate=Yes;';

let pool;

export async function getPool() {
  try {
    if (!pool) {
      pool = await sql.connect({
        connectionString
      });

      console.log('Conectado correctamente a SQL Server con autenticación de Windows');
    }

    return pool;
  } catch (error) {
    console.error('Error al conectar con SQL Server:', error.message);
    throw error;
  }
}

export { sql };