// Painel de vendas (só do vendedor): login, lista de pagos, marcar enviado, trocar senha.
const crypto = require('crypto');
const { sb } = require('./_lib');
const { HASH_INICIAL } = require('./_senha');

const CFG = '_cfg_admin'; // linha especial na tabela curso_pedidos guardando o hash da senha atual
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
  const r = await sb(`curso_pedidos?order_nsu=eq.${CFG}&select=nome`); // falha = erro (não aceita a senha inicial às cegas)
  if (r && r[0] && r[0].nome) return r[0].nome;
  return HASH_INICIAL;
}
// Traduz o erro do banco em uma dica clara (só aparece para quem tem a senha ou na tela de login).
function explicar(msg) {
  const m = String(msg || '');
  if (/SUPABASE_URL|SUPABASE_SERVICE_KEY/.test(m)) return 'Faltam as variáveis SUPABASE_URL e/ou SUPABASE_SERVICE_KEY no Vercel do curso-checkout.';
  if (/PGRST205|PGRST106|does not exist|schema cache/i.test(m)) return 'A tabela "curso_pedidos" não existe nesse Supabase. Rode o arquivo supabase.sql no SQL Editor.';
  if (/Supabase 401|Supabase 403|Invalid API key|JWT/i.test(m)) return 'A chave SUPABASE_SERVICE_KEY está errada (use a service_role, não a anon).';
  if (/permission denied/i.test(m)) return 'Sem permissão na tabela. Rode de novo o "grant all on public.curso_pedidos to service_role" do supabase.sql.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(m)) return 'O endereço SUPABASE_URL parece errado ou o projeto está pausado.';
  return '';
}
// Token assinado com o hash atual: trocar a senha invalida todos os acessos antigos.
function assinar(exp, hash) {
  return crypto.createHmac('sha256', hash).update(String(exp)).digest('hex');
}
function novoToken(hash) {
  const exp = Date.now() + VALIDADE_MS;
  return `${exp}.${assinar(exp, hash)}`;
}
function tokenOk(token, hash) {
  const [exp, sig] = String(token || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const esperado = assinar(exp, hash);
  return sig.length === esperado.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
}
function lerBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}

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
      const lista = await sb(
        'curso_pedidos?status=in.(pago,avisado,entregue)&select=order_nsu,nome,email,whatsapp,status,forma_pagamento,pago_em,entregue_em&order=pago_em.desc.nullslast&limit=300'
      );
      return res.status(200).json({
        pedidos: lista || [],
        links: { site: process.env.COURSE_URL_SITE || null, outro: null }
      });
    }

    if (req.method === 'POST' && body.acao === 'trocar') {
      const nova = String(body.novaSenha || '');
      if (!confere(body.senhaAtual, hash)) return res.status(403).json({ error: 'A senha atual está errada.' });
      if (nova.length < 10) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 10 caracteres.' });
      if (nova.length > 100) return res.status(400).json({ error: 'Senha muito longa.' });
      const novoHash = hashar(nova);
      await sb('curso_pedidos?on_conflict=order_nsu', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { order_nsu: CFG, nome: novoHash, email: '-', whatsapp: '-', status: 'config' }
      });
      return res.status(200).json({ ok: true, token: novoToken(novoHash) });
    }

    if (req.method === 'POST') {
      const nsu = String(body.order_nsu || '');
      if (!/^[A-Za-z0-9_-]{3,80}$/.test(nsu) || nsu === CFG) return res.status(400).json({ error: 'Pedido inválido.' });
      const enviado = body.enviado === true;
      await sb(`curso_pedidos?order_nsu=eq.${encodeURIComponent(nsu)}&status=in.(pago,avisado,entregue)`, {
        method: 'PATCH',
        body: enviado
          ? { status: 'entregue', entregue_em: new Date().toISOString() }
          : { status: 'pago', entregue_em: null },
        prefer: 'return=minimal'
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    console.error('admin:', e.message);
    return res.status(500).json({
      error: 'Erro ao falar com o banco de dados.',
      dica: explicar(e.message),
      detalhe: String(e.message).slice(0, 300)
    });
  }
};
