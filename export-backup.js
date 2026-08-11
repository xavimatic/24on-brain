const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env o .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const connectionString = process.env.DATABASE_URL || 'postgresql://admin_cerebro:TuPasswordSeguro123@localhost:5432/segundo_cerebro_db?schema=public';

async function exportBackup() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log('Conectado a PostgreSQL...');

  // Obtener todas las tablas del esquema public
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log('Tablas encontradas:', tables);

  // Definir orden preferido para respetar FKs si fuera necesario, o desactivar FKs durante la restauración
  let sqlLines = [
    '-- Backup generado automáticamente por export-backup.js',
    `-- Fecha: ${new Date().toISOString()}`,
    'SET client_encoding = \'UTF8\';',
    'SET standard_conforming_strings = on;',
    'SET check_function_bodies = false;',
    'SET xmloption = content;',
    'SET client_min_messages = warning;',
    'SET row_security = off;',
    '',
    '-- Desactivar verificación de llaves foráneas durante el restore',
    'SET session_replication_role = \'replica\';',
    ''
  ];

  function formatValue(val) {
    if (val === null || val === undefined) {
      return 'NULL';
    }
    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE';
    }
    if (typeof val === 'number') {
      return val.toString();
    }
    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }
    if (Array.isArray(val)) {
      // Formato array de PostgreSQL ARRAY['item1', 'item2']
      const formattedItems = val.map(item => {
        if (typeof item === 'string') {
          return `'${item.replace(/'/g, "''")}'`;
        }
        return formatValue(item);
      });
      return `ARRAY[${formattedItems.join(', ')}]`;
    }
    if (typeof val === 'object') {
      // JSON / JSONB
      const jsonStr = JSON.stringify(val).replace(/'/g, "''");
      return `'${jsonStr}'::jsonb`;
    }
    if (typeof val === 'string') {
      return `'${val.replace(/'/g, "''")}'`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  for (const table of tables) {
    console.log(`Exportando tabla ${table}...`);
    // Escapar nombre de tabla
    const tableNameEscaped = `"${table}"`;

    // Obtener columnas de la tabla
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `, [table]);

    const columns = colsRes.rows.map(c => c.column_name);
    const colsEscaped = columns.map(c => `"${c}"`).join(', ');

    // Obtener filas
    const rowsRes = await client.query(`SELECT * FROM ${tableNameEscaped}`);
    const rows = rowsRes.rows;

    sqlLines.push(`-- Datos para la tabla: ${table} (${rows.length} registros)`);

    if (rows.length > 0) {
      for (const row of rows) {
        const values = columns.map(col => formatValue(row[col]));
        sqlLines.push(`INSERT INTO ${tableNameEscaped} (${colsEscaped}) VALUES (${values.join(', ')});`);
      }
    } else {
      sqlLines.push(`-- (Sin registros)`);
    }

    // Si tiene columna 'id', ajustar secuencia
    if (columns.includes('id')) {
      sqlLines.push(`SELECT setval(pg_get_serial_sequence('${tableNameEscaped}', 'id'), coalesce(max(id), 1), max(id) IS NOT NULL) FROM ${tableNameEscaped};`);
    }

    sqlLines.push('');
  }

  sqlLines.push('-- Reactivar verificación de llaves foráneas');
  sqlLines.push('SET session_replication_role = \'origin\';');
  sqlLines.push('');

  const outputPath = path.join(__dirname, 'backup_utf8.sql');
  fs.writeFileSync(outputPath, sqlLines.join('\n'), 'utf8');

  console.log(`✅ Exportación completada con éxito. Archivo guardado en: ${outputPath}`);
  await client.end();
}

exportBackup().catch(err => {
  console.error('❌ Error exportando la base de datos:', err);
  process.exit(1);
});
