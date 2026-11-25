import fs from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from './navegador.js';
import { construirHtmlResumen } from '../src/reports/html.js';
import { generarPdf } from '../src/reports/pdf.js';
import { enviarReporte } from '../src/mailer.js';
import { resumenEjecutivo } from '../src/ai/resumen.js';

/** Etapa final de una ejecución: resumen con IA, informe PDF, reporte HTML y correo. */
export async function generarSalidas(corrida, navegador, carpeta, log) {
  try { log('Generando resumen ejecutivo…'); corrida.resumenIA = await resumenEjecutivo(corrida); }
  catch (e) { log('No se pudo generar el resumen ejecutivo: ' + e.message); }

  const nombreHtml = `reporte-resumen-${corrida.id}.html`;
  fs.writeFileSync(path.join(carpeta, nombreHtml), construirHtmlResumen(corrida));
  corrida.archivos.html = nombreHtml; log('Reporte HTML generado');

  let propio = null;
  try {
    const nav = navegador || (propio = await abrirNavegador());
    const destino = await generarPdf(corrida, carpeta, nav);
    corrida.archivos.pdf = path.basename(destino); log('Informe detallado PDF generado');
  } catch (e) { log('No se pudo generar el PDF: ' + e.message); corrida.archivos.errorPdf = e.message; }
  finally { if (propio) await propio.close().catch(() => {}); }

  try {
    log(`Enviando reportes a ${corrida.email}…`);
    corrida.correo = await enviarReporte(corrida, carpeta);
    log(corrida.correo.estado === 'enviado' ? 'Correo enviado' : 'Correo simulado guardado');
  } catch (e) {
    corrida.correo = { estado: 'error', destinatario: corrida.email, detalle: 'No se pudo enviar el correo: ' + e.message };
    log(corrida.correo.detalle);
  }
}
