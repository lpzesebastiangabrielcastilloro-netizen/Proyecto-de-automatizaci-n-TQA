<<<<<<< HEAD
# Banco de pruebas Body Solid

Proyecto integrador de **Automatización de Pruebas (TQA)**. Es una plataforma que ejecuta pruebas **reales** sobre el sistema Body Solid (gimnasio) desde una interfaz web, genera un **informe detallado en PDF** y un **reporte resumen en HTML**, y los envía por correo al destinatario que se indique. Incluye una funcionalidad con **Inteligencia Artificial** que convierte un requerimiento en un caso Gherkin ejecutable.

> Este proyecto **no reemplaza** al sistema Body Solid: lo evalúa. El sistema se ejecuta aparte y este banco de pruebas lo prueba desde afuera, como lo haría un usuario o un cliente de su API.

## Qué hace (flujo completo)

| Etapa | Qué ocurre |
|---|---|
| 1. Selección | En la interfaz se elige tipo (funcional / no funcional), categoría, alcance (toda la categoría o casos específicos) y el correo destinatario. |
| 2. Ejecución | Se ejecutan los casos de verdad: Playwright abre un navegador y usa el sistema; las pruebas de API, carga y resistencia llaman a los servicios. |
| 3. Generación | Se crean el informe detallado (PDF) y el reporte resumen (HTML). |
| 4. Envío | Ambos archivos se envían como adjuntos con el asunto «Reporte de automatización – *suite* – *fecha*». |

Cada ejecución recibe un **ID** (por ejemplo `EJ-20261121-100407-04c0`) que relaciona la interfaz, el registro, las evidencias, los reportes y el correo. Todo queda en `runs/<ID>/`.

## Tecnologías

- **Node.js 18+** con **Express** (servidor y orquestador de ejecuciones).
- **Playwright** (automatización de navegador, capturas de evidencia y generación del PDF).
- **Nodemailer** (envío por SMTP).
- Interfaz web en HTML, CSS y JavaScript sin dependencias.
- IA opcional: **Claude (Anthropic)** o **Gemini (Google)**; sin claves funciona con reglas locales.

## Requisitos

1. Node.js 18 o superior.
2. El sistema **body-solid** en funcionamiento (por defecto en `http://localhost:3000`).
3. Chromium de Playwright (se instala con un comando, ver abajo).

## Instalación

```bash
git clone <URL-de-tu-repositorio>
cd automatizacion-tqa
npm install
npx playwright install chromium
cp .env.example .env        # en Windows: copy .env.example .env
```

## Configuración (variables de entorno)

Edita el archivo `.env` (no se sube a GitHub). Las variables principales:

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `SUT_URL` | Dirección de body-solid | `http://localhost:3000` |
| `PORT` | Puerto de este banco de pruebas | `4000` |
| `HEADLESS` | `false` para ver el navegador mientras prueba | `true` |
| `SUT_FIXED_DATE` | Fecha fija para pruebas repetibles (las membresías semilla de body-solid vencen en 2026) | `2026-05-30T10:00:00` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envío real de correo | vacío (modo simulado) |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | IA externa (opcional) | vacío (reglas locales) |

**Nunca escribas contraseñas ni claves en el código.** Solo van en `.env`, y los reportes no las incluyen (las contraseñas de los formularios se muestran como `••••••••`).

### Enviar correos reales con Gmail

1. Activa la **verificación en 2 pasos** en tu cuenta de Google.
2. Crea una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>.
3. En `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=tu_correo@gmail.com
   SMTP_PASS=la_contraseña_de_aplicación
   MAIL_FROM=tu_correo@gmail.com
   ```

Si `SMTP_HOST` queda vacío, el banco funciona en **modo simulado**: arma el correo completo con sus dos adjuntos y lo guarda como `correo-simulado.eml` en la carpeta de la ejecución. La interfaz lo indica claramente; no pretende haberlo enviado.

## Cómo ejecutarlo

1. Inicia el sistema **body-solid** (en su carpeta: `npm run dev`).
2. En otra terminal, en esta carpeta:
   ```bash
   npm start
   ```
3. Abre <http://localhost:4000>.

La esquina superior derecha indica si body-solid está disponible. Si no responde, la ejecución no se lanza.

### Uso de la interfaz

1. **Tipo de pruebas:** Funcionales o No funcionales.
2. **Categoría:** Smoke, Sanity, Regression, Integration, End-to-End, Carga, Estrés, Resistencia, Performance, Usabilidad, Seguridad, etc.
3. **Alcance:** toda la categoría o solo los casos que marques.
4. **Correo destinatario:** se valida el formato.
5. **Ejecutar pruebas.** El estado pasa por *Pendiente → En curso → Finalizada / Fallida* y cada caso aparece como un pocillo de la placa que cambia de color y de símbolo (✓ PASS, ✕ FAIL, – SKIPPED, ○ NOT RUN). Al terminar aparecen los enlaces al informe PDF y al reporte HTML, el estado del correo y un resumen ejecutivo. Al hacer clic en un caso se ven sus pasos y las capturas.

### Ejecución desde consola (opcional)

```bash
npm run ejecutar -- --tipo funcional --suite Smoke --email tu@correo.com
npm run ejecutar -- --tipo no_funcional --suite Carga --email tu@correo.com
npm run ejecutar -- --tipo funcional --suite End-to-End --casos TC-E2E-001,TC-E2E-003 --email tu@correo.com
```

## Casos de prueba (32)

Detalle completo en [`docs/CATALOGO_DE_PRUEBAS.md`](docs/CATALOGO_DE_PRUEBAS.md).

| Tipo | Categorías |
|---|---|
| Funcionales | Smoke (3), Sanity (3), Regression (7), Integration (4), End-to-End (4), Fallo controlado (1) |
| No funcionales | Performance (3), Carga (2), Estrés (1), Resistencia (1), Usabilidad (2), Seguridad (1) |

- **Estados:** PASS, FAIL, SKIPPED o NOT RUN por caso. Se registran fecha y hora de inicio y fin, duración y resultado global.
- **Fallo funcional vs. error de infraestructura:** si el sistema o el navegador no están disponibles, los casos quedan **NOT RUN** con la etiqueta *Error de infraestructura* (la ejecución termina como *Fallida*); un resultado incorrecto del sistema es **FAIL** con la etiqueta *Fallo funcional*. Los errores del propio script se marcan como *Error del proceso de ejecución*.
- **Fallo controlado:** `TC-FAL-001` está diseñado para fallar a propósito y demostrar cómo se reportan el error, el paso y la evidencia.
- **Caso omitido:** `TC-REG-007` (pago con tarjeta real) se omite a propósito porque requiere una pasarela externa.

### Hallazgo real encontrado por las pruebas

`TC-SEC-001` **falla de verdad**: `GET /api/members` devuelve la contraseña en texto plano de los 7 socios y no exige autenticación. Es un defecto de seguridad del sistema evaluado, no un error de la prueba. Se deja así porque es justo lo que una automatización de calidad debe detectar. Cuando body-solid lo corrija, el caso pasará.

## Reportes

- **Informe detallado (PDF):** datos generales, resumen, y por cada caso: ID y nombre, objetivo, precondiciones y datos, resultado esperado, pasos ejecutados con lo esperado y lo obtenido, **capturas de pantalla junto a cada paso**, estado y observación. Si falla: mensaje de error, paso donde ocurrió, evidencia y cómo reproducirlo.
- **Reporte resumen (HTML):** archivo independiente (sin recursos externos) con tabla de ID, nombre, tipo/suite, estado y observación; el estado se muestra siempre con texto y símbolo, no solo con color. Incluye filtros por estado.

Ejemplos reales en [`docs/ejemplos/`](docs/ejemplos): ejecución aprobada, con caso omitido, con fallo controlado, con el hallazgo de seguridad y una generada con IA.

## Funcionalidad de Inteligencia Artificial

Pestaña **Asistente de IA**. Flujo:

1. **Entrada:** se escribe o carga un caso de prueba o requerimiento (hay un ejemplo de la guía).
2. **Inspección real:** el banco abre la aplicación y lista los elementos que existen en la pantalla elegida. **Los selectores nunca se inventan**: todo localizador propuesto se contrasta con esa lista y, si no existe, el paso se marca «No existe» y no se ejecuta.
3. **Análisis:** se detectan ambigüedades, datos faltantes y preguntas de aclaración.
4. **Gherkin:** se genera el escenario (Given, When, And, Then) y escenarios **negativos y de borde** (contraseña incorrecta, usuario inexistente, longitud extrema, campos vacíos).
5. **Pasos automatizables:** se proponen pasos ejecutables sobre los elementos verificados.
6. **Revisión y aprobación:** la persona revisa, marca los escenarios y aprueba. Solo entonces se ejecutan.
7. **Resultado:** PASS/FAIL **sale de la ejecución real** (con capturas y logs), nunca de la IA. Se genera el mismo informe PDF y el reporte HTML, y se envía por correo.

Además, **cada informe incluye un resumen ejecutivo** con las posibles causas de los fallos, citando la evidencia (paso, captura o mensaje).

**Proveedores:** con `ANTHROPIC_API_KEY` o `GEMINI_API_KEY` se usa el modelo correspondiente; sin claves se usan **reglas locales** (interpretación de texto, detección de ambigüedades y plantillas de escenarios). La interfaz y los reportes indican siempre cuál se usó. Si la IA externa falla, el banco vuelve a las reglas locales y lo avisa.

## Estructura del proyecto

```
server/        Servidor Express, motor de ejecución, configuración y salidas
src/ai/        Proveedor de IA, inspector de la aplicación, generador Gherkin, resumen
src/reports/   Generadores del reporte HTML y del informe PDF
src/mailer.js  Envío de correo (SMTP o modo simulado)
tests/         Casos de prueba (funcionales/ y no-funcionales/) y datos de prueba
public/        Interfaz web
scripts/       Ejecución desde consola
runs/          Resultados de cada ejecución (evidencias, reportes, correo) - no se sube a Git
docs/          Catálogo, ejemplos, guion del video y guía de entrega
```

## Datos de prueba

Se usan las **cuentas de demostración** que trae body-solid (administrador, entrenador, cliente y una cuenta inactiva), definidas en `tests/datos-prueba.json`. No son datos reales ni credenciales personales. El caso de alta de socio crea un registro temporal y lo elimina al final.

## Solución de problemas

| Problema | Qué hacer |
|---|---|
| «Body Solid no responde» | Inicia body-solid y revisa `SUT_URL` en `.env`. |
| «No se pudo abrir Chromium» | Ejecuta `npx playwright install chromium`. |
| El correo no llega | Revisa las variables `SMTP_*`; con Gmail usa una contraseña de aplicación. Mira el estado del correo en la interfaz. |
| Pruebas del panel de cliente fallan por fechas | Deja `SUT_FIXED_DATE` con su valor por defecto. |
| Puerto 4000 ocupado | Cambia `PORT` en `.env`. |

## Limitaciones conocidas

- Solo se ejecuta una corrida a la vez.
- Las reglas locales de IA están afinadas para flujos como el inicio de sesión; con un modelo de lenguaje cubren requerimientos más variados.
- Los datos de body-solid viven en memoria: al reiniciarlo vuelven al estado semilla.
=======
# Proyecto-de-automatizaci-n-TQA
>>>>>>> de4cf5f49832761f08488790b01dad6510f1042d
