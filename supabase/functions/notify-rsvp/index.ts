// ══════════════════════════════════════════════════════════════
//  Edge Function: notify-rsvp
//  Dispara en cada INSERT sobre public.guests (via Database Webhook).
//  Si el registro es el PRIMER miembro de su family_group,
//  espera 2s y manda un único email resumen a los novios via Brevo.
//  Ese delay permite que el batch de la familia (varios INSERTs
//  en milisegundos) quede reflejado en DB antes de leer.
// ══════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") ?? "info@ketoreal.com";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") ?? "Boda Sofia y Javier";
const NOVIO_EMAIL = Deno.env.get("NOVIO_EMAIL")!;
const NOVIA_EMAIL = Deno.env.get("NOVIA_EMAIL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADMIN_URL = "https://sofi-javi.com/admin/invitados.html";

interface GuestRecord {
  id: number;
  nombre: string;
  apellidos: string;
  menu: string | null;
  autobus: string | null;
  alergias: string | null;
  family_group: string | null;
  is_child: boolean;
  email: string | null;
  created_at: string;
}

function bus(code: string | null): string {
  if (code === "no") return "Vehículo propio";
  if (code === "plaza-castilla") return "Autobús Plaza de Castilla";
  if (code === "alcobendas") return "Autobús Alcobendas";
  return "—";
}

function menuLabel(g: GuestRecord): string {
  if (g.is_child) return "Menú infantil";
  if (!g.menu) return "—";
  return g.menu.charAt(0).toUpperCase() + g.menu.slice(1);
}

async function fetchFamily(familyGroup: string): Promise<GuestRecord[]> {
  const url = `${SUPABASE_URL}/rest/v1/guests?family_group=eq.${encodeURIComponent(familyGroup)}&select=*&order=created_at.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetchFamily HTTP ${res.status}`);
  return await res.json();
}

async function sendBrevo(subject: string, htmlContent: string, textContent: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [
        { email: NOVIO_EMAIL, name: "Javier" },
        { email: NOVIA_EMAIL, name: "Sofia" },
      ],
      subject,
      htmlContent,
      textContent,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

function buildEmail(titular: GuestRecord, family: GuestRecord[]) {
  const total = family.length;
  const adultos = family.filter((g) => !g.is_child).length;
  const ninos = family.filter((g) => g.is_child).length;
  const transportCommon = titular.autobus;

  const groupLabel = total === 1
    ? "1 persona"
    : `${total} personas (${adultos} adulto${adultos !== 1 ? "s" : ""}${ninos ? `, ${ninos} niño${ninos > 1 ? "s" : ""}` : ""})`;

  const membersHtml = family.map((g) => {
    const allergyBadge = g.alergias
      ? `<span style="display:inline-block;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:6px">⚠ ${escapeHtml(g.alergias)}</span>`
      : "";
    return `<li style="padding:6px 0;border-bottom:1px solid #f0ece6">
      <strong>${escapeHtml(g.nombre)} ${escapeHtml(g.apellidos)}</strong>
      ${g.is_child ? '<span style="color:#2e7d32;font-size:12px;margin-left:6px">(niño/a)</span>' : ""}
      <span style="color:#8a7a5a;font-size:13px;margin-left:8px">— ${escapeHtml(menuLabel(g))}</span>
      ${allergyBadge}
    </li>`;
  }).join("");

  const membersText = family.map((g) => {
    const kid = g.is_child ? " (niño/a)" : "";
    const alergias = g.alergias ? ` · alergias: ${g.alergias}` : "";
    return `• ${g.nombre} ${g.apellidos}${kid} — ${menuLabel(g)}${alergias}`;
  }).join("\n");

  const emailAportacion = family.find((g) => g.email)?.email;
  const aportacionHtmlBlock = emailAportacion
    ? `<div style="margin:20px 0;padding:14px;background:#fff8e1;border:1px solid #e8d5b0;border-radius:8px">
        <strong style="color:#7a5a00">💌 Pide info de aportación:</strong><br>
        <a href="mailto:${escapeHtml(emailAportacion)}" style="color:#b8860b">${escapeHtml(emailAportacion)}</a>
        <div style="font-size:12px;color:#8a6b00;margin-top:4px">Acuérdate de enviarle el IBAN y marcarlo como enviado en el panel.</div>
       </div>`
    : "";

  const aportacionText = emailAportacion
    ? `\n\n💌 Pide info de aportación: ${emailAportacion}\n   (Acuérdate de enviarle el IBAN y marcarlo como enviado en el panel)`
    : "";

  const subject = `Nueva confirmación: ${titular.nombre} ${titular.apellidos}${total > 1 ? ` (+${total - 1})` : ""}`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#faf7f1;padding:20px;margin:0;color:#2c2c2c">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#C9A96E,#E8D5B0);padding:24px;text-align:center;color:#ffffff">
      <div style="font-size:32px;margin-bottom:4px">💍</div>
      <h1 style="margin:0;font-size:20px;font-weight:600">Nueva confirmación</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9">Sofía y Javier — 29 agosto 2026</p>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(titular.nombre)} ${escapeHtml(titular.apellidos)}</h2>
      <p style="margin:0 0 16px;color:#8a7a5a;font-size:14px">${escapeHtml(groupLabel)} · ${escapeHtml(bus(transportCommon))}</p>
      <h3 style="font-size:14px;color:#8a7a5a;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.05em">Miembros</h3>
      <ul style="list-style:none;padding:0;margin:0">${membersHtml}</ul>
      ${aportacionHtmlBlock}
      <div style="margin-top:24px;text-align:center">
        <a href="${ADMIN_URL}" style="display:inline-block;background:#C9A96E;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px">Ver en el panel</a>
      </div>
    </div>
    <div style="padding:14px;background:#faf7f1;text-align:center;font-size:11px;color:#999">
      Aviso automático · <a href="${ADMIN_URL}" style="color:#C9A96E">sofi-javi.com/admin</a>
    </div>
  </div>
</body>
</html>`;

  const textContent = `Nueva confirmación para la boda

Titular: ${titular.nombre} ${titular.apellidos}
Grupo: ${groupLabel}
Transporte: ${bus(transportCommon)}

Miembros:
${membersText}${aportacionText}

Ver en el panel: ${ADMIN_URL}`;

  return { subject, htmlContent, textContent };
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  try {
    const payload = await req.json();

    // Supabase Database Webhook shape:
    // { type: "INSERT" | "UPDATE" | "DELETE", table, schema, record, old_record }
    if (payload.type !== "INSERT" || payload.table !== "guests") {
      return new Response("ignored", { status: 200 });
    }

    const record = payload.record as GuestRecord;
    if (!record.family_group) {
      // Sin family_group no podemos agrupar — enviar sin detalle de familia
      const { subject, htmlContent, textContent } = buildEmail(record, [record]);
      const r = await sendBrevo(subject, htmlContent, textContent);
      return new Response(JSON.stringify({ single: true, brevo: r }), { status: r.ok ? 200 : 500 });
    }

    // Esperar 2s para que todos los miembros del batch estén en DB
    await new Promise((r) => setTimeout(r, 2000));

    const family = await fetchFamily(record.family_group);
    if (family.length === 0) {
      return new Response("no family rows", { status: 200 });
    }

    const titular = family[0];

    // De-dupe: si este INSERT no es el primero del family_group, salir.
    // Evita enviar N emails cuando insertan N miembros en batch.
    if (titular.id !== record.id) {
      return new Response("not titular, skipping", { status: 200 });
    }

    const { subject, htmlContent, textContent } = buildEmail(titular, family);
    const r = await sendBrevo(subject, htmlContent, textContent);

    if (!r.ok) {
      console.error("Brevo failed:", r.status, r.body);
      return new Response(JSON.stringify({ error: "brevo_failed", status: r.status, body: r.body }), { status: 500 });
    }

    return new Response(JSON.stringify({ sent: true, family_size: family.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-rsvp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
