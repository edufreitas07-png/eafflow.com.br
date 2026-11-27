// Funções de apoio. O prefixo "_" impede a Vercel de expor este arquivo como rota.

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Aceita o endereço colado de vários jeitos: só o código do projeto, sem https://, com /rest/v1 ou com barra no fim.
function urlSupabase(bruto) {
  let u = String(bruto || '').trim().replace(/^["']|["']$/g, '');
  if (!u) return '';
  if (/^[a-z0-9]{20}$/.test(u)) u = `https://${u}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/rest\/v1\/?.*$/i, '').replace(/\/+$/, '');
}

// Acesso ao Supabase pela API REST, com a chave de serviço (só no servidor).
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const base = urlSupabase(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados');

  const resp = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`Supabase ${resp.status}: ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

// Envio de e-mail pela Resend (https://resend.com).
async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Curso <onboarding@resend.dev>';
  if (!key) throw new Error('RESEND_API_KEY não configurada');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
}

module.exports = { sb, sendEmail, escapeHtml };
