// ══════════════════════════════════════════════════════════════
//  Edge Function: notify-rsvp
//  Dispara en cada INSERT sobre public.guests (via Database Webhook).
//  Si el registro es el PRIMER miembro de su family_group:
//    1) espera 2s (por si llegan más inserts del batch),
//    2) manda un email resumen a los novios,
//    3) manda al titular un email bonito con el resumen y el IBAN,
//    4) marca info_enviada_at en el titular tras éxito.
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
const SITE_URL = "https://sofi-javi.com";
const IBAN = "ES13 0182 7066 2002 0065 3919";
const EVENT_DATE = "29 de agosto de 2026";
const EVENT_TIME = "17:15h";
const EVENT_PLACE = "Antigua Fábrica de Harinas, Madrid";

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

type Recipient = { email: string; name?: string };

function bus(code: string | null): string {
  if (code === "no") return "Vehículo propio";
  if (code === "plaza-castilla") return "Autobús desde Plaza de Castilla";
  if (code === "alcobendas") return "Autobús desde Alcobendas";
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

async function markInfoEnviada(guestId: number): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/guests?id=eq.${guestId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ info_enviada_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("markInfoEnviada failed:", res.status, body);
  }
}

async function sendBrevo(
  to: Recipient[],
  subject: string,
  htmlContent: string,
  textContent: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to,
      subject,
      htmlContent,
      textContent,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

// ────────────────────────────────────────────
//  Email a los NOVIOS (aviso interno)
// ────────────────────────────────────────────
function buildNoviosEmail(titular: GuestRecord, family: GuestRecord[]) {
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

  const emailInvitado = titular.email ?? "—";
  const resumenHtmlBlock = titular.email
    ? `<div style="margin:20px 0;padding:14px;background:#f4fbf2;border:1px solid #cfe8c9;border-radius:8px">
        <strong style="color:#2e7d32">✉ Resumen enviado al invitado:</strong><br>
        <span style="color:#1b5e20">${escapeHtml(emailInvitado)}</span>
        <div style="font-size:12px;color:#4a6e44;margin-top:4px">Le hemos mandado el resumen de su reserva con el IBAN integrado (concepto = su nombre completo).</div>
       </div>`
    : `<div style="margin:20px 0;padding:14px;background:#fff3e0;border:1px solid #ffcc80;border-radius:8px">
        <strong style="color:#b76e00">⚠ Sin email de invitado</strong>
        <div style="font-size:12px;color:#8a5200;margin-top:4px">No hemos podido enviarle resumen. Si quieres hacérselo llegar, usa el panel.</div>
       </div>`;

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
      ${resumenHtmlBlock}
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
Email del invitado: ${emailInvitado}

Miembros:
${membersText}

Ver en el panel: ${ADMIN_URL}`;

  return { subject, htmlContent, textContent };
}

// ────────────────────────────────────────────
//  Email al INVITADO (resumen bonito + IBAN)
// ────────────────────────────────────────────
function daysUntilWedding(): number {
  const wedding = new Date("2026-08-29T17:15:00+02:00").getTime();
  const now = Date.now();
  const days = Math.ceil((wedding - now) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

function buildInviteeEmail(titular: GuestRecord, family: GuestRecord[]) {
  const total = family.length;
  const adultos = family.filter((g) => !g.is_child).length;
  const ninos = family.filter((g) => g.is_child).length;

  const groupLabel = total === 1
    ? "1 persona"
    : `${total} personas (${adultos} adulto${adultos !== 1 ? "s" : ""}${ninos ? `, ${ninos} niño${ninos > 1 ? "s" : ""}` : ""})`;

  const concepto = `${titular.nombre} ${titular.apellidos}`.trim();
  const diasRestantes = daysUntilWedding();

  const membersHtml = family.map((g) => {
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0ece6;vertical-align:middle">
        <div style="display:inline-block;width:8px;height:8px;background:#C9A96E;border-radius:50%;margin-right:10px;vertical-align:middle"></div>
        <strong style="color:#2c2c2c;font-size:15px">${escapeHtml(g.nombre)} ${escapeHtml(g.apellidos)}</strong>
        ${g.is_child ? '<span style="display:inline-block;background:#f1f8e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px;font-weight:500">niño/a</span>' : ""}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #f0ece6;text-align:right;color:#8a7a5a;font-size:13px;vertical-align:middle">
        <span style="display:inline-block;background:#faf7f1;padding:4px 10px;border-radius:12px;color:#6b5a3a">🍽️ ${escapeHtml(menuLabel(g))}</span>
      </td>
    </tr>`;
  }).join("");

  const membersText = family.map((g) => {
    const kid = g.is_child ? " (niño/a)" : "";
    return `  • ${g.nombre} ${g.apellidos}${kid} — ${menuLabel(g)}`;
  }).join("\n");

  const alergiasList = family.filter((g) => g.alergias && g.alergias.trim());
  const alergiasHtmlBlock = alergiasList.length > 0
    ? `<div style="margin:24px 28px;padding:16px 18px;background:#fff3e0;border-left:4px solid #e65100;border-radius:8px">
        <strong style="color:#b76e00;font-size:13px;letter-spacing:0.03em">⚠ Alergias / intolerancias</strong>
        <ul style="margin:8px 0 0;padding:0 0 0 18px;color:#6e4100;font-size:13px;line-height:1.7">
          ${alergiasList.map((g) => `<li><strong>${escapeHtml(g.nombre)}:</strong> ${escapeHtml(g.alergias!)}</li>`).join("")}
        </ul>
       </div>`
    : "";

  const alergiasText = alergiasList.length > 0
    ? `\n⚠ Alergias:\n${alergiasList.map((g) => `  • ${g.nombre}: ${g.alergias}`).join("\n")}`
    : "";

  const subject = `💍 Reserva confirmada — Boda Sofía & Javier`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Georgia,'Times New Roman',serif;background:#f5efe4;padding:24px 12px;margin:0;color:#2c2c2c;line-height:1.55">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 32px rgba(185,155,100,0.18)">

    <!-- Hero con monograma -->
    <div style="background:linear-gradient(135deg,#C9A96E 0%,#D4B87A 50%,#E8D5B0 100%);padding:48px 24px 40px;text-align:center;color:#ffffff;position:relative">
      <div style="font-size:13px;letter-spacing:0.35em;text-transform:uppercase;opacity:0.9;margin-bottom:18px">— Nuestra boda —</div>
      <div style="display:inline-block;width:92px;height:92px;line-height:92px;border:2px solid #ffffff;border-radius:50%;font-family:Georgia,serif;font-size:32px;font-weight:400;letter-spacing:0.05em;margin-bottom:14px;background:rgba(255,255,255,0.12)">S &amp; J</div>
      <h1 style="margin:0;font-family:Georgia,serif;font-size:34px;font-weight:400;letter-spacing:0.02em;font-style:italic">¡Reserva confirmada!</h1>
      <div style="font-size:14px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.95;margin-top:14px">29 · Agosto · 2026</div>
    </div>

    <!-- Countdown -->
    <div style="padding:26px 28px 10px;text-align:center">
      <div style="display:inline-block;background:#faf7f1;border-radius:14px;padding:14px 28px">
        <div style="font-size:11px;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:2px">Faltan</div>
        <div style="font-family:Georgia,serif;font-size:30px;color:#C9A96E;font-weight:400">${diasRestantes} <span style="font-size:16px;color:#8a7a5a;font-style:italic">días</span></div>
      </div>
    </div>

    <!-- Saludo -->
    <div style="padding:20px 36px 0;text-align:center">
      <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:22px;color:#2c2c2c;font-style:italic">¡Hola ${escapeHtml(titular.nombre)}!</p>
      <p style="margin:10px 0 0;font-size:15px;color:#5a5a5a;line-height:1.7">
        Muchísimas gracias por confirmar vuestra asistencia.<br>
        Nos hace ilusión teneros ahí con nosotros. 🥹
      </p>
    </div>

    <!-- Divisor ornamental -->
    <div style="text-align:center;padding:28px 28px 0;color:#C9A96E;font-size:14px;letter-spacing:0.6em">✦ ✦ ✦</div>

    <!-- Datos del evento -->
    <div style="padding:18px 28px 0">
      <div style="background:#faf7f1;border-radius:14px;padding:22px 24px">
        <div style="text-align:center;font-size:11px;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.25em;margin-bottom:14px">El día</div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;font-size:15px;color:#4a4a4a;width:32px">📅</td>
            <td style="padding:8px 0;font-size:15px;color:#2c2c2c"><strong>${EVENT_DATE}</strong> · ${EVENT_TIME}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:15px;color:#4a4a4a">📍</td>
            <td style="padding:8px 0;font-size:14px;color:#4a4a4a">${EVENT_PLACE}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:15px;color:#4a4a4a">🚌</td>
            <td style="padding:8px 0;font-size:14px;color:#4a4a4a">${escapeHtml(bus(titular.autobus))}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Quienes vienen -->
    <div style="padding:22px 28px 0">
      <div style="text-align:center;font-size:11px;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.25em;margin-bottom:12px">Vuestra reserva — ${escapeHtml(groupLabel)}</div>
      <table style="width:100%;border-collapse:collapse">
        ${membersHtml}
      </table>
    </div>

    ${alergiasHtmlBlock}

    <!-- Divisor ornamental -->
    <div style="text-align:center;padding:24px 28px 0;color:#C9A96E;font-size:14px;letter-spacing:0.6em">✦ ✦ ✦</div>

    <!-- Regalo / IBAN -->
    <div style="padding:18px 28px 0">
      <div style="background:linear-gradient(135deg,#fff8e1 0%,#fff1c7 100%);border:1px solid #e8d5b0;border-radius:14px;padding:26px 24px">
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:34px;margin-bottom:4px">💌</div>
          <div style="font-family:Georgia,serif;font-size:20px;color:#2c2c2c;font-style:italic">Por si te hace ilusión hacernos un regalo</div>
        </div>
        <p style="margin:0 0 18px;font-size:14px;color:#5a4a20;text-align:center;line-height:1.7">
          Lo más importante es que estés ahí con nosotros.<br>
          Pero si además quieres tener un detalle, te dejamos los datos:
        </p>
        <div style="background:#ffffff;border-radius:12px;padding:18px 20px;border:1px dashed #c9a96e">
          <div style="font-size:11px;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.2em;margin-bottom:6px">IBAN</div>
          <div style="font-family:'Courier New',Consolas,monospace;font-size:17px;font-weight:600;color:#2c2c2c;letter-spacing:0.06em;word-break:break-all">${IBAN}</div>
          <div style="font-size:11px;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.2em;margin:16px 0 6px">Concepto <span style="color:#b76e00">(importante)</span></div>
          <div style="font-family:'Courier New',Consolas,monospace;font-size:16px;font-weight:600;color:#2c2c2c">${escapeHtml(concepto)}</div>
          <div style="font-size:12px;color:#8a6b00;margin-top:12px;font-style:italic;line-height:1.6;padding-top:10px;border-top:1px solid #f0e6cc">
            ⚡ Por favor pon tu nombre completo en el concepto — es la única manera de saber de quién viene el ingreso.
          </div>
        </div>
      </div>
    </div>

    <!-- Mensaje guardar -->
    <div style="padding:22px 28px 0">
      <div style="background:#f4fbf2;border-radius:14px;padding:20px 22px;text-align:center">
        <div style="font-size:26px;margin-bottom:6px">💾</div>
        <p style="margin:0;font-size:14px;color:#2e5a28;font-weight:500;line-height:1.6">
          Guárdate este email para acordarte de todos los datos<br>y no perderte este día tan especial.
        </p>
      </div>
    </div>

    <!-- CTA a la web -->
    <div style="padding:26px 28px 8px;text-align:center">
      <a href="${SITE_URL}" style="display:inline-block;background:#C9A96E;color:#ffffff;padding:14px 32px;border-radius:30px;text-decoration:none;font-weight:500;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;box-shadow:0 4px 12px rgba(201,169,110,0.3)">Ver los detalles en la web</a>
    </div>

    <!-- Firma -->
    <div style="padding:24px 28px 32px;text-align:center">
      <div style="color:#C9A96E;font-size:12px;letter-spacing:0.6em;margin-bottom:16px">✦ ✦ ✦</div>
      <p style="margin:0;font-size:15px;color:#6a6a6a;font-style:italic">Con muchísimo cariño,</p>
      <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:28px;color:#C9A96E;font-style:italic;letter-spacing:0.02em">Sofía &amp; Javier</p>
    </div>

    <!-- Footer -->
    <div style="padding:18px;background:#faf7f1;text-align:center;font-size:11px;color:#a89a7a;letter-spacing:0.08em">
      <a href="${SITE_URL}" style="color:#C9A96E;text-decoration:none">SOFI-JAVI.COM</a>
    </div>

  </div>
</body>
</html>`;

  const textContent = `¡Hola ${titular.nombre}!

Muchísimas gracias por confirmar vuestra asistencia a nuestra boda.
Este es el resumen de tu reserva:

📅 ${EVENT_DATE} · ${EVENT_TIME}
📍 ${EVENT_PLACE}
🚌 ${bus(titular.autobus)}

Quiénes venís — ${groupLabel}:
${membersText}${alergiasText}

💌 Por si te hace ilusión hacernos un regalo:
   IBAN: ${IBAN}
   Concepto: ${concepto}
   (Por favor pon tu nombre completo en el concepto — es la única manera de saber de quién viene el ingreso.)

Guárdate este email para acordarte de todos los datos y no perderte este día tan especial.

Con muchísimo cariño,
Sofía & Javier
${SITE_URL}`;

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

    if (payload.type !== "INSERT" || payload.table !== "guests") {
      return new Response("ignored", { status: 200 });
    }

    const record = payload.record as GuestRecord;

    if (!record.family_group) {
      // Sin family_group: enviar solo a novios, no hay modo de agrupar
      const single = buildNoviosEmail(record, [record]);
      const r = await sendBrevo(
        [{ email: NOVIO_EMAIL, name: "Javier" }, { email: NOVIA_EMAIL, name: "Sofia" }],
        single.subject,
        single.htmlContent,
        single.textContent,
      );
      return new Response(JSON.stringify({ single: true, brevo: r }), { status: r.ok ? 200 : 500 });
    }

    // Esperar 2s para que todos los miembros del batch estén en DB
    await new Promise((r) => setTimeout(r, 2000));

    const family = await fetchFamily(record.family_group);
    if (family.length === 0) {
      return new Response("no family rows", { status: 200 });
    }

    const titular = family[0];

    // De-dupe: solo el primer INSERT (titular) dispara envíos
    if (titular.id !== record.id) {
      return new Response("not titular, skipping", { status: 200 });
    }

    // 1) Email a los novios
    const novios = buildNoviosEmail(titular, family);
    const rNovios = await sendBrevo(
      [{ email: NOVIO_EMAIL, name: "Javier" }, { email: NOVIA_EMAIL, name: "Sofia" }],
      novios.subject,
      novios.htmlContent,
      novios.textContent,
    );
    if (!rNovios.ok) console.error("Brevo novios failed:", rNovios.status, rNovios.body);

    // 2) Email al invitado (si nos dejó email)
    let rInvitado: { ok: boolean; status: number; body: string } | null = null;
    if (titular.email) {
      const invitee = buildInviteeEmail(titular, family);
      rInvitado = await sendBrevo(
        [{ email: titular.email, name: `${titular.nombre} ${titular.apellidos}` }],
        invitee.subject,
        invitee.htmlContent,
        invitee.textContent,
      );
      if (!rInvitado.ok) {
        console.error("Brevo invitado failed:", rInvitado.status, rInvitado.body);
      } else {
        // 3) Marcar info_enviada_at solo si el envío al invitado fue OK
        await markInfoEnviada(titular.id);
      }
    }

    return new Response(
      JSON.stringify({
        sent: true,
        family_size: family.length,
        novios_ok: rNovios.ok,
        invitado_sent: !!titular.email,
        invitado_ok: rInvitado?.ok ?? null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-rsvp error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
