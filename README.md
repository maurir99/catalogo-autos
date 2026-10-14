# Easy Car — catálogo de autos

Página publicada en **https://easycarmotor.com** (Vercel).

Página web para mostrar vehículos en venta. Los clientes ven fotos, precios y especificaciones, y con el botón **Comprar por WhatsApp** te escriben directo con un mensaje armado. Vos entrás como vendedor para cargar, editar, reservar o marcar como vendidos los vehículos.

- **Página:** HTML, CSS y JavaScript sin compilar (no hace falta instalar nada).
- **Datos, fotos y login:** [Supabase](https://supabase.com) (plan gratis).
- **Publicación:** Vercel, Netlify o Cloudflare Pages conectado a este repositorio.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Diseño (colores, tipografías, tamaños) |
| `app.js` | Lógica: catálogo, filtros, WhatsApp, panel de administrador |
| `config.js` | Datos de conexión con tu Supabase (lo completás vos) |
| `supabase/schema.sql` | Tablas, permisos y almacenamiento de fotos |

---

## Puesta en marcha

### 1. Crear el proyecto en Supabase
1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un **New project**. Elegí la región más cercana (São Paulo) y guardá la contraseña de la base.
2. Esperá a que termine de crearse (1–2 minutos).

### 2. Crear las tablas y permisos
1. En el menú izquierdo: **SQL Editor → New query**.
2. Copiá todo el contenido de `supabase/schema.sql`, pegalo y tocá **Run**.
3. Debería decir *Success*. Esto crea la tabla de autos, los datos del negocio, el lugar para las fotos y los permisos (cualquiera ve, solo el administrador modifica).

### 3. Crear tu usuario de vendedor
1. **Authentication → Users → Add user → Create new user**.
2. Poné tu email y una contraseña, y marcá **Auto Confirm User**.
3. Recomendado: en **Authentication → Sign In / Providers**, desactivá **Allow new users to sign up** para que nadie más pueda crearse una cuenta.

### 4. Hacerte administrador
En **SQL Editor** ejecutá esto, cambiando el email por el tuyo:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'tu-email@gmail.com'
on conflict do nothing;
```

Si más adelante querés sumar a otro vendedor, creale un usuario (paso 3) y repetí este paso con su email.

### 5. Conectar la página
1. En Supabase tocá el botón verde **Connect** (arriba). En el código de ejemplo vas a ver la URL (`..._SUPABASE_URL=https://...supabase.co`) y la clave (`..._PUBLISHABLE_KEY=sb_publishable_...`). Copialas con el botón de copiar del recuadro.
2. Abrí `config.js` y reemplazá `SUPABASE_URL` y `SUPABASE_ANON_KEY` con esos valores.
3. Guardá y subí el cambio a GitHub (commit + push).

> La clave publishable (o anon) es pública por diseño. Lo que protege tus datos son los permisos del paso 2. **Nunca** pongas en `config.js` la clave `service_role`.

### 6. Publicar en internet (Vercel)
1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → elegí `catalogo-autos` → **Import**.
3. En *Framework Preset* elegí **Other**. No cambies nada más y tocá **Deploy**.
4. En un minuto tenés la dirección (tipo `catalogo-autos.vercel.app`). Cada cambio que subas a GitHub se publica solo.
5. Para usar tu propio dominio: **Settings → Domains** en Vercel.

### 7. Primer uso
1. Abrí la página y tocá **Acceso vendedor** (abajo de todo). Ingresá con el usuario del paso 3.
2. Tocá **Datos del negocio**: nombre, WhatsApp (formato `595981123456`) y dirección.
3. Tocá **+ Cargar vehículo** y subí el primero.

---

## Editar el código con Claude

1. Instalá [VS Code](https://code.visualstudio.com) y la extensión **Claude Code**.
2. Cloná el repositorio (en VS Code: *Clone Git Repository* → `maurir99/catalogo-autos`).
3. Pedile cambios a Claude en el panel, por ejemplo: *"agregá un filtro por rango de precio"*.
4. Para ver la página en tu compu mientras editás, instalá la extensión **Live Server** y hacé clic derecho en `index.html` → *Open with Live Server*.
5. Cuando estés conforme, hacé commit y push: Vercel publica la nueva versión sola.

## Ajustes rápidos

En `app.js`, arriba de todo:

- `MAX_FOTOS`: cantidad máxima de fotos por vehículo (12).
- `DIAS_VENDIDO_VISIBLE`: cuántos días se sigue mostrando un auto vendido al público (14).
- `USD_A_PYG`: cotización usada solo para ordenar por precio cuando mezclás dólares y guaraníes.

Los colores están al principio de `styles.css` (`--sign` es el amarillo de los precios, `--asphalt` el fondo de la barra superior).

## Compartir un vehículo

Cada ficha tiene su propio link (`tu-pagina.com/#auto-...`). En el detalle está el botón **Copiar link de este vehículo** para pegarlo en Instagram, Marketplace o estados de WhatsApp. El mensaje que recibe el vendedor por WhatsApp también incluye ese link.
