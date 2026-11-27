// Painel de vendas (só do vendedor): login, lista de pagos, marcar enviado, link do curso,
// notificações no celular e troca de senha.
const crypto = require('crypto');
const { sb, lerConfig, gravarConfig, chavesPush, avisarAparelhos } = require('./_lib');
const { HASH_INICIAL } = require('./_senha');

const VALIDADE_MS = 30 * 24 * 3600 * 1000;

function hashar(senha) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(senha), salt, 32);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
function confere(senha, guardado) {
  const [alg, salt, h] = String(guardado).split('$');
  if (alg !== 'scrypt' || !salt || !h) return false;
  const calc = crypto.scryptSync(String(senha || ''), Buffer.from(salt, 'hex'), 32);
  const alvo = Buffer.from(h, 'hex');
  return calc.length === alvo.length && crypto.timingSafeEqual(calc, alvo);
}
async function hashAtual() {
  // Falha de banco vira erro: não aceita a senha inicial às cegas.
  return (await lerConfig('admin_hash')) || HASH_INICIAL;
}
function explicar(msg) {
  const m = String(msg || '');
  if (/SUPABASE_URL|SUPABASE_SERVICE_KEY/.test(m)) return 'Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_KEY nas variáveis do Vercel deste projeto.';
  if (/PGRST205|PGRST106|does not exist|schema cache/i.test(m)) return 'As tabelas curso_site_* não existem nesse Supabase.';
  if (/Supabase 401|Supabase 403|Invalid API key|JWT/i.test(m)) return 'A chave SUPABASE_SERVICE_KEY está errada (use a service_role, não a anon).';
  if (/permission denied/i.test(m)) return 'Sem permissão nas tabelas curso_site_*. Falta o grant para service_role.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(m)) return 'O endereço SUPABASE_URL parece errado ou o projeto está pausado.';
  return '';
}
function assinar(exp, hash) { return crypto.createHmac('sha256', hash).update(String(exp)).digest('hex'); }
function novoToken(hash) { const exp = Date.now() + VALIDADE_MS; return `${exp}.${assinar(exp, hash)}`; }
function tokenOk(token, hash) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const esperado = assinar(exp, hash);
  return sig.length === esperado.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}
const lerBody = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
const eurl = (v) => /^https:\/\/\S+$/i.test(String(v || '')) && String(v).length <= 500;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  try {
    const hash = await hashAtual();
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const body = req.method === 'POST' ? lerBody(req) : {};

    if (req.method === 'POST' && body.acao === 'login') {
      if (!confere(body.senha, hash)) {
        await new Promise((r) => setTimeout(r, 800)); // freia tentativas em sequência
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
      return res.status(200).json({ token: novoToken(hash) });
    }

    if (!tokenOk(auth, hash)) return res.status(401).json({ error: 'Sessão expirada. Entre de novo.' });

    if (req.method === 'GET') {
      const [lista, linkBanco, k, subs] = await Promise.all([
        sb('curso_site_pedidos?status=in.(pago,entregue)&select=order_nsu,nome,email,whatsapp,status,forma_pagamento,valor_centavos,pago_em,entregue_em&order=pago_em.desc.nullslast&limit=300'),
        lerConfig('link_curso'),
        chavesPush(),
        sb('curso_site_push?select=endpoint')
      ]);
      return res.status(200).json({
        pedidos: lista || [],
        link: linkBanco || process.env.COURSE_URL_SITE || '',
        vapid: k.publicKey,
        aparelhos: (subs || []).length
      });
    }

    if (req.method === 'POST' && body.acao === 'link') {
      const link = String(body.link || '').trim();
      if (link && !eurl(link)) return res.status(400).json({ error: 'O link precisa começar com https://' });
      await gravarConfig('link_curso', link);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && body.acao === 'push_inscrever') {
      const s = body.inscricao || {};
      const k = s.keys || {};
      if (!eurl(s.endpoint) || !k.p256dh || !k.auth) return res.status(400).json({ error: 'Inscrição inválida.' });
      await sb('curso_site_push?on_conflict=endpoint', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { endpoint: s.endpoint, p256dh: String(k.p256dh), auth: String(k.auth) }
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && body.acao === 'push_cancelar') {
      if (eurl(body.endpoint)) {
        await sb(`curso_site_push?endpoint=eq.${encodeURIComponent(body.endpoint)}`, { method: 'DELETE', prefer: 'return=minimal' });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && body.acao === 'push_teste') {
      const rel = await avisarAparelhos({ titulo: 'Teste de notificação ✅', corpo: 'Se você está vendo isso, os avisos de venda funcionam.', tag: 'teste', url: '/vendas/' }, { limpar: false });
      return res.status(200).json({ ok: true, ...rel });
    }

    if (req.method === 'POST' && body.acao === 'trocar') {
      const nova = String(body.novaSenha || '');
      if (!confere(body.senhaAtual, hash)) return res.status(403).json({ error: 'A senha atual está errada.' });
      if (nova.length < 10) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 10 caracteres.' });
      if (nova.length > 100) return res.status(400).json({ error: 'Senha muito longa.' });
      const novoHash = hashar(nova);
      await gravarConfig('admin_hash', novoHash);
      return res.status(200).json({ ok: true, token: novoToken(novoHash) });
    }

    if (req.method === 'POST' && body.order_nsu) {
      const nsu = String(body.order_nsu);
      if (!/^[A-Za-z0-9_-]{3,80}$/.test(nsu)) return res.status(400).json({ error: 'Pedido inválido.' });
      const enviado = body.enviado === true;
      await sb(`curso_site_pedidos?order_nsu=eq.${encodeURIComponent(nsu)}&status=in.(pago,entregue)`, {
        method: 'PATCH',
        body: enviado ? { status: 'entregue', entregue_em: new Date().toISOString() } : { status: 'pago', entregue_em: null },
        prefer: 'return=minimal'
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Pedido inválido.' });
  } catch (e) {
    console.error('admin:', e.message);
    return res.status(500).json({
      error: 'Erro ao falar com o banco de dados.',
      dica: explicar(e.message),
      detalhe: String(e.message).slice(0, 300)
    });
  }
};
