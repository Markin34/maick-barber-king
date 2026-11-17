# Maick Barber King · Reservas en línea

Página de la barbería: el cliente elige barbero, servicio, día y hora. **Las horas ya reservadas salen tachadas** y la reserva se guarda en Supabase, así nadie puede tomar la misma hora. Después el cliente avisa al barbero por WhatsApp con un botón. También tiene una tienda donde el pedido se envía por WhatsApp.

**No hay pagos en línea ni registro de clientes: se paga en la barbería, en efectivo o QR.**

Hecha con Astro 5, TypeScript, **React 19**, **Motion** (animaciones), Tailwind CSS 4, Zod y Supabase (Postgres). Las páginas salen como HTML ya listo; React solo se carga en el reservador, la tienda y el panel. Las animaciones se bajan aparte, después de que la página ya funciona, y se apagan solas si el celular tiene activado "reducir movimiento".

Tiene un **panel para el dueño** en una dirección secreta (variable `PANEL_RUTA`, ver `src/lib/panel.ts`; `/admin` no existe a propósito): citas de hoy, agenda, bloqueos, búsqueda, resumen de ingresos y reservas nuevas en vivo.

## Lo que necesitas

- [Node.js](https://nodejs.org) 20.3 o más nuevo (recomendado: 24 LTS)
- VS Code con las extensiones recomendadas (VS Code te las sugiere al abrir la carpeta)
- Una cuenta gratis de [Supabase](https://supabase.com)

## Comandos

| Comando | Para qué |
|---|---|
| `npm install` | Instala todo. Solo la primera vez. |
| `npm run dev` | Abre la página en http://localhost:4321 y se actualiza sola al guardar. |
| `npm test` | Pruebas de la lógica y de la base de datos (en un Postgres de prueba, sin internet). |
| `npm run test:e2e` | Simula clientes reservando en un celular, con un Supabase simulado. |
| `npm run build` | Revisa tipos y genera la página final en `dist/`. |
| `npm run verificar` | Lint + pruebas + build. Córrelo antes de publicar. |

## Conectar Supabase (una sola vez)

1. Entra a [supabase.com](https://supabase.com) → **New project**. Nombre: `maick-barber-king`. Región: **South America (São Paulo)**, la más cercana a Bolivia. Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando termine de crearse: **SQL Editor → New query**. Copia y pega **todo** el archivo `supabase/migrations/0001_reservas.sql` y pulsa **Run**. Debe decir *Success*. Repite con `0002_admin.sql` (el panel del dueño).
3. **Project Settings → API Keys**. Copia:
   - la **Project URL** (algo como `https://abcd1234.supabase.co`), que también sale en **Project Settings → Data API**;
   - la **Publishable key** (`sb_publishable_…`). Si tu proyecto solo muestra la clave `anon`, usa esa.
4. En esta carpeta, copia `.env.example` como `.env` y pega los dos valores:
   ```
   PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   ```
5. Corre `npm run dev`, haz una reserva de prueba y revisa que aparezca en Supabase → **Table Editor → reservas**.

> **Nunca uses la clave secreta** (`sb_secret_…` o `service_role`) en la página. Si la pegas por error, el build se detiene y te avisa.

### Qué puede hacer la clave pública

La clave que va en la página **no puede leer ni borrar reservas**. Solo puede llamar dos funciones:

- `horarios_ocupados`: devuelve el inicio y el fin de las horas tomadas, **sin nombres de clientes**.
- `crear_reserva`: guarda una reserva si la hora sigue libre. La base de datos impide que dos reservas del mismo barbero se crucen, aunque dos personas toquen "Confirmar" al mismo segundo. También rechaza horas pasadas y frena abusos: más de 3 reservas futuras con el mismo nombre, o más de 30 reservas en 10 minutos.

### El día a día del dueño (desde el panel de Supabase)

- **Ver la agenda:** Table Editor → vista **`agenda`**. Muestra las reservas de hoy en adelante, en hora de Bolivia.
- **Cancelar una cita:** Table Editor → **`reservas`** → cambia `estado` a `cancelada`. La hora vuelve a quedar libre en la página.
- **Bloquear horas** (vacaciones, día libre, una cita tomada por teléfono): Table Editor → **`bloqueos`** → Insert row. Pon `inicio` y `fin` con la hora de Bolivia, por ejemplo `2026-11-20 13:00:00-04`. Si dejas `barbero` vacío, el bloqueo es para todos.

### Si Supabase no responde

La página no se rompe. Le muestra al cliente *"No pudimos revisar qué horas están ocupadas"*, con un botón para reintentar y otro para reservar solo por WhatsApp, como en la versión sin base de datos.

> **Ojo con el plan gratis:** Supabase pausa los proyectos que pasan **7 días sin uso**. Con reservas casi todos los días no pasa. Si se pausa, se reactiva desde el panel de Supabase con un clic, y mientras tanto la página sigue funcionando por WhatsApp.

Si no pones las variables de Supabase, la página funciona sin base de datos: no tacha horas y el barbero confirma por WhatsApp.

## Panel del dueño (dirección secreta, ver `src/lib/panel.ts`)

La dirección no está en el código: sale de la variable `PANEL_RUTA` (en Vercel, obligatoria). En tu computadora, sin la variable, el panel queda en `/panel-local-pruebas`.

**Crear el acceso (una sola vez):**
1. Supabase → **Authentication → Users → Add user → Create new user**. Pon el correo y una contraseña del dueño y marca *Auto Confirm User*.
2. Supabase → **SQL Editor**, corre esto con el correo del dueño:
   ```sql
   insert into public.administradores (user_id, nombre)
   select id, 'Dueño' from auth.users where email = 'correo-del-dueno@ejemplo.com';
   ```
3. Recomendado: **Authentication → Sign In / Providers** → apaga **Allow new users to sign up**. Así nadie más puede crearse una cuenta (aunque lo hiciera, no vería nada: la base solo muestra datos a quien está en `administradores`).

**Qué hace:**

| Sección | Para qué |
|---|---|
| Hoy | Citas del día por barbero, cuántas faltan, estimado del día y la próxima cita |
| Agenda | Día o semana, filtro por barbero y búsqueda por nombre o código |
| Acciones | ✅ Asistió · ❌ No vino · 🚫 Cancelar (pide un segundo toque) · WhatsApp al barbero |
| Bloqueos | Bloquear horas o el día entero, para un barbero o para todos |
| Resumen | Citas e ingresos estimados de la semana o el mes, por barbero y por servicio |
| En vivo | Si entra una reserva con el panel abierto, aparece sola y avisa |

La seguridad está en la base de datos, no en la página: el panel solo puede **cambiar el estado** de una cita (no el nombre, la hora ni el barbero) y solo si el usuario está en `administradores`.
## Cambiar el contenido

Todo está en **`src/data/`**. No hace falta tocar nada más.

| Archivo | Qué tiene |
|---|---|
| `negocio.ts` | Nombre, WhatsApp de la tienda, dirección, Google Maps, redes, horario, forma de pago |
| `barberos.ts` | Nombre, apodo, especialidad, WhatsApp y foto de cada barbero. Horario propio si es distinto |
| `servicios.ts` | Nombre, descripción, precio en Bs y duración en minutos |
| `productos.ts` | Nombre, categoría, precio, foto. `disponible: false` lo muestra como agotado |

**Si escribes algo mal** (un WhatsApp sin +591, una hora "9:00" en vez de "09:00", un precio con centavos), la página **no se publica** y el error dice qué archivo y qué campo corregir.

> El `id` de cada barbero (`micki`, `apu`, `victor`) es lo que se guarda en Supabase. Si lo cambias, las reservas viejas quedan con el id anterior.

### Fotos

1. Guarda la foto en `src/assets/barberos/` o `src/assets/productos/` (jpg, png o webp).
2. En el dato, escribe la ruta: `foto: 'barberos/micki.jpg'` o `imagen: 'productos/cera-mate.jpg'`.

Astro las convierte a WebP y del tamaño justo. Sin foto, se muestran las iniciales.

### Reglas de reserva (en `negocio.ts`)

- `intervaloMin`: cada cuánto se ofrece una hora (15, 20, 30 o 60).
- `diasAnticipacion`: hasta cuántos días adelante se puede reservar.
- `minutosMinimos`: no deja reservar para dentro de menos de estos minutos.
- `descanso`: horario de almuerzo; no se ofrecen horas que lo pisen.

La hora se calcula siempre con la de Bolivia (`America/La_Paz`), aunque el celular del cliente tenga otra hora.

## Publicar en Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com).
2. Sube este proyecto a GitHub (o usa `npx vercel` desde esta carpeta).
3. En Vercel: **Add New → Project**, elige el repositorio. Detecta Astro solo.
4. Antes de pulsar Deploy, abre **Environment Variables** y agrega `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los mismos valores del `.env`, y `PANEL_RUTA` con la dirección secreta del panel.
5. Pulsa **Deploy**. Queda en una dirección `*.vercel.app`.

**Dominio:** en el proyecto de Vercel, **Settings → Domains → Buy**, busca `maickbarberking.com` y cómpralo. Se conecta solo. Después agrega en Vercel la variable `SITIO_URL=https://maickbarberking.com` y vuelve a publicar, para que Google y la vista previa de WhatsApp usen el dominio. Sin esa variable se usa la dirección `*.vercel.app`.

> El plan gratis de Vercel (Hobby) es solo para uso no comercial. Si algún día lo piden, la página se puede mover a Cloudflare Pages o Netlify sin cambiar el código.

## Código QR

Cuando la página esté publicada, genera el QR con el link (por ejemplo, desde Chrome: menú ⋮ → Compartir → Crear código QR) e imprímelo para el espejo o la caja.

## Estructura

```
src/
  data/          Contenido editable y sus reglas de validación (Zod)
  lib/           Lógica sin interfaz: horarios, WhatsApp, carrito, Supabase, formato. Con pruebas.
  components/    Partes de la página (.astro) y componentes de React (react/reservar, react/tienda, react/admin)
  layouts/       Plantilla base: SEO, fuentes, datos para Google
  pages/         index, reservar, tienda, admin, 404
  assets/fotos/  Fotos (de ejemplo por ahora: ver CREDITOS.md)
supabase/
  migrations/    Tablas, seguridad y funciones de la base de datos
tests/
  unit/          Vitest (incluye la base de datos en un Postgres de prueba con PGlite)
  e2e/           Playwright en un celular simulado, con Supabase simulado
docs/propuesta/  La propuesta que se le mostró al cliente
```

## Antes de lanzar

- Cambiar las fotos de ejemplo por fotos reales (`src/assets/fotos/CREDITOS.md`).
- Poner los WhatsApp, precios, horario y dirección reales en `src/data/`.
