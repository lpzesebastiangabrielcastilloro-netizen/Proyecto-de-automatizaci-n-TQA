import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const datosPrueba = JSON.parse(fs.readFileSync(path.join(raiz, 'tests', 'datos-prueba.json'), 'utf8'));
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  raiz,
  puerto: num(process.env.PORT, 4000),
  urlSistema: (process.env.SUT_URL || 'http://localhost:3000').replace(/\/$/, ''),
  headless: process.env.HEADLESS !== 'false',
  rutaChrome: process.env.CHROME_PATH || undefined,
  fechaFija: process.env.SUT_FIXED_DATE === undefined ? '2026-05-30T10:00:00' : process.env.SUT_FIXED_DATE,
  segundosResistencia: num(process.env.SOAK_SECONDS, 15),
  carpetaEjecuciones: path.join(raiz, 'runs'),
  cuentas: datosPrueba.cuentas,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    usuario: process.env.SMTP_USER || '',
    clave: process.env.SMTP_PASS || '',
    remitente: process.env.MAIL_FROM || process.env.SMTP_USER || 'banco-de-pruebas@localhost',
  },
  ia: {
    proveedor: (process.env.AI_PROVIDER || 'auto').toLowerCase(),
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModelo: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiModelo: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },
};
