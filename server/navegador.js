import { chromium } from 'playwright';
import { config } from './config.js';

/** Abre Chromium. Si no está instalado, lanza un error claro de infraestructura. */
export async function abrirNavegador() {
  try {
    return await chromium.launch({ headless: config.headless, executablePath: config.rutaChrome });
  } catch (e) {
    const err = new Error(
      'No se pudo abrir Chromium. Ejecuta "npx playwright install chromium" (o define CHROME_PATH). Detalle: ' +
        String(e.message).split('\n')[0]
    );
    err.name = 'ErrorInfraestructura';
    throw err;
  }
}

/** Crea un contexto con viewport estándar y, si está configurada, fecha fija. */
export async function nuevoContexto(browser, opciones = {}) {
  const contexto = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'es-BO',
    ...opciones,
  });
  if (config.fechaFija) {
    try { await contexto.clock.setFixedTime(new Date(config.fechaFija)); } catch { /* versión sin clock */ }
  }
  return contexto;
}
