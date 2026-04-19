# notify-rsvp — Edge Function

Envía un email resumen a los novios cuando alguien confirma asistencia.

## Secrets necesarios (Supabase → Project Settings → Edge Functions → Secrets)

| Key | Valor | De dónde |
|-----|-------|----------|
| `BREVO_API_KEY` | `xkeysib-...` | Cuenta Brevo de Keto Real (ya existente) |
| `BREVO_SENDER_EMAIL` | `info@ketoreal.com` | Sender verificado en Brevo (opcional, tiene default) |
| `BREVO_SENDER_NAME` | `Boda Sofia y Javier` | Nombre que verán los novios (opcional) |
| `NOVIO_EMAIL` | `jvrlopezmartinez@gmail.com` | Fijo |
| `NOVIA_EMAIL` | `sofialst8@gmail.com` | Fijo |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles por defecto en Edge Functions (inyectados por Supabase).

## Deploy

```bash
cd D:/boda-javier-sofia
npx supabase login
npx supabase link --project-ref lpatzgviideumccecfew

npx supabase secrets set \
  BREVO_API_KEY=xkeysib-... \
  NOVIO_EMAIL=jvrlopezmartinez@gmail.com \
  NOVIA_EMAIL=sofialst8@gmail.com

npx supabase functions deploy notify-rsvp --no-verify-jwt
```

`--no-verify-jwt` es necesario porque el Database Webhook no firma con JWT.

## Configurar Database Webhook

Dashboard Supabase → **Database → Webhooks → Create a new hook**:

- Name: `notify-novios-rsvp`
- Table: `public.guests`
- Events: ☑ **Insert** (solo)
- Type: **Supabase Edge Functions**
- Edge Function: `notify-rsvp`
- HTTP Method: POST

## De-duplicación

La función comprueba que el INSERT que recibe sea el del "titular" (primer miembro cronológico de `family_group`). Si no lo es, sale sin hacer nada. Así, cuando una familia registra 4 personas (4 INSERTs en batch), solo se dispara UN email con los 4 miembros agrupados.

Espera 2s tras recibir el INSERT para dar tiempo a que el batch termine en DB.

## Test manual

Inserta una fila en `guests` desde el SQL Editor de Supabase:

```sql
INSERT INTO guests (nombre, apellidos, family_group, is_child, menu, autobus, email)
VALUES ('TEST', 'Webhook', 'fam_test_' || now(), false, 'carne', 'no', 'test@example.com');
```

Debería llegar un email a los novios en 2-5 segundos. Luego borrar:

```sql
DELETE FROM guests WHERE nombre = 'TEST' AND apellidos = 'Webhook';
```
