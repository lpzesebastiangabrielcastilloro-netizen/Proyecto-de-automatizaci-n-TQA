import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from '../server/config.js';
import { esc, fechaHora, duracion } from './reports/comun.js';

export const correoValido = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(t || '').trim());
export const smtpConfigurado = () => Boolean(config.smtp.host && config.smtp.usuario && config.smtp.clave);

/** Envía el informe PDF y el reporte HTML. Sin SMTP, guarda un .eml de verificación. */
export async function enviarReporte(corrida, carpeta) {
  const adjuntos = [];
  if (corrida.archivos.pdf) adjuntos.push({ filename: corrida.archivos.pdf, path: path.join(carpeta, corrida.archivos.pdf) });
  if (corrida.archivos.html) adjuntos.push({ filename: corrida.archivos.html, path: path.join(carpeta, corrida.archivos.html) });
  const r = corrida.resumen;
  const asunto = `Reporte de automatización – ${corrida.suite} – ${fechaHora(corrida.inicio)}`;
  const texto = `Resultado de la ejecución ${corrida.id}\nSuite: ${corrida.suite}\nTotal: ${r.total} · PASS: ${r.pass} · FAIL: ${r.fail} · SKIPPED: ${r.skipped} · NOT RUN: ${r.notRun}\nÉxito: ${r.exito}% · Duración: ${duracion(corrida.duracionMs)}\nSe adjuntan el informe detallado (PDF) y el reporte resumen (HTML).`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0E1F2B;max-width:560px">
  <h2 style="margin:0 0 4px">Reporte de automatización – ${esc(corrida.suite)}</h2>
  <p style="margin:0 0 14px;color:#5B6B78">Ejecución ${esc(corrida.id)} · ${esc(fechaHora(corrida.inicio))} · ${esc(duracion(corrida.duracionMs))}</p>
  <table cellpadding="8" style="border-collapse:collapse;border:1px solid #D5DEE5;width:100%"><tr style="background:#EEF3F6"><th align="left">Total</th><th align="left">PASS</th><th align="left">FAIL</th><th align="left">SKIPPED</th><th align="left">NOT RUN</th><th align="left">Éxito</th></tr>
  <tr><td>${r.total}</td><td>${r.pass}</td><td>${r.fail}</td><td>${r.skipped}</td><td>${r.notRun}</td><td><b>${r.exito}%</b></td></tr></table>
  <p>Resultado global: <b>${esc(corrida.resultadoGlobal)}</b></p><p style="color:#5B6B78;font-size:13px">Adjuntos: informe detallado (PDF) y reporte resumen (HTML).</p></div>`;

  const simulado = !smtpConfigurado();
  const transporte = simulado
    ? nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
    : nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, auth: { user: config.smtp.usuario, pass: config.smtp.clave } });

  const info = await transporte.sendMail({ from: config.smtp.remitente, to: corrida.email, subject: asunto, text: texto, html, attachments: adjuntos });
  if (simulado) {
    fs.writeFileSync(path.join(carpeta, 'correo-simulado.eml'), info.message);
    corrida.archivos.eml = 'correo-simulado.eml';
    return { estado: 'simulado', asunto, destinatario: corrida.email, detalle: 'SMTP no configurado: el correo se guardó como correo-simulado.eml (no se envió a ninguna bandeja).', adjuntos: adjuntos.map((a) => a.filename) };
  }
  return { estado: 'enviado', asunto, destinatario: corrida.email, detalle: `Correo enviado a ${corrida.email}.`, id: info.messageId, adjuntos: adjuntos.map((a) => a.filename) };
}
