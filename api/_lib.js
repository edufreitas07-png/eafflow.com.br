// Funções de apoio. O prefixo "_" impede a Vercel de expor este arquivo como rota.
const webpush = require('web-push');

// Aceita o endereço colado de vários jeitos: só o código do projeto, sem https://, com /rest/v1 ou barra no fim.
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

async function lerConfig(chave) {
  const r = await sb(`curso_site_config?chave=eq.${encodeURIComponent(chave)}&select=valor`);
  return r && r[0] ? r[0].valor : null;
}
async function gravarConfig(chave, valor) {
  await sb('curso_site_config?on_conflict=chave', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { chave, valor, atualizado_em: new Date().toISOString() }
  });
}

// Chaves das notificações: criadas sozinhas na primeira vez e guardadas no banco (só o servidor lê).
async function chavesPush() {
  const pub = await lerConfig('vapid_public');
  const priv = await lerConfig('vapid_private');
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  const k = webpush.generateVAPIDKeys();
  await gravarConfig('vapid_public', k.publicKey);
  await gravarConfig('vapid_private', k.privateKey);
  return k;
}

// Manda a notificação para todos os aparelhos inscritos. Nunca derruba quem chamou.
async function avisarAparelhos(payload, { limpar = true } = {}) {
  const rel = { aparelhos: 0, enviados: 0, falhas: [] };
  try {
    const k = await chavesPush();
    webpush.setVapidDetails(process.env.VAPID_CONTACT || 'mailto:contato@eafflow.com.br', k.publicKey, k.privateKey);
    const subs = (await sb('curso_site_push?select=endpoint,p256dh,auth')) || [];
    rel.aparelhos = subs.length;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 86400, urgency: 'high' }
        );
        rel.enviados++;
      } catch (e) {
        rel.falhas.push({ status: e && e.statusCode, erro: String((e && (e.body || e.message)) || '').slice(0, 160) });
        if (limpar && e && (e.statusCode === 404 || e.statusCode === 410)) {
          await sb(`curso_site_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
        } else {
          console.warn('push falhou', e && e.statusCode, e && e.body);
        }
      }
    }));
  } catch (e) {
    console.warn('avisarAparelhos:', e.message);
    rel.falhas.push({ erro: e.message });
  }
  return rel;
}

module.exports = { sb, lerConfig, gravarConfig, chavesPush, avisarAparelhos };
