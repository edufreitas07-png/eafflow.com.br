// Recebe o aviso da InfinitePay, confirma o pagamento direto nela e registra a venda.
// O aviso não é assinado: nada é aceito só por ele. Tudo passa por /payment_check.
// Variáveis: INFINITEPAY_HANDLE, SUPABASE_URL, SUPABASE_SERVICE_KEY. Opcionais: PRICE_CENTS_SITE,
// NOTIFY_EMAIL + RESEND_API_KEY + EMAIL_FROM (aviso por e-mail ao vendedor).
// A entrega do acesso é pelo painel (vendas.eafflow.com.br), com o botão do WhatsApp.
const { sb, sendEmail, escapeHtml } = require('./_lib');

const PAYMENT_CHECK = 'https://api.checkout.infinitepay.io/payment_check';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const handle = process.env.INFINITEPAY_HANDLE;
  const price = parseInt(process.env.PRICE_CENTS_SITE || '1000', 10);
  if (!handle) return res.status(500).json({ error: 'Servidor sem configuração.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { order_nsu: orderNsu, transaction_nsu: transactionNsu, invoice_slug: slug } = body;
  if (!orderNsu || !transactionNsu || !slug) return res.status(400).json({ error: 'Aviso incompleto.' });

  try {
    const pedidos = await sb(`curso_pedidos?order_nsu=eq.${encodeURIComponent(orderNsu)}&select=*`);
    const pedido = pedidos && pedidos[0];
    if (!pedido || !String(orderNsu).startsWith('site-')) return res.status(400).json({ error: 'Pedido desconhecido.' });
    if (pedido.status === 'pago' || pedido.status === 'entregue') return res.status(200).json({ ok: true, ja_registrado: true });

    const chk = await fetch(PAYMENT_CHECK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug })
    });
    const check = await chk.json().catch(() => ({}));
    if (!chk.ok) throw new Error(`payment_check HTTP ${chk.status}`);
    if (!check.success || !check.paid) return res.status(400).json({ error: 'Pagamento não confirmado.' });
    if (check.amount !== price) return res.status(400).json({ error: 'Valor da cobrança diferente do esperado.' });

    await sb(`curso_pedidos?order_nsu=eq.${encodeURIComponent(orderNsu)}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        status: 'pago',
        transaction_nsu: transactionNsu,
        forma_pagamento: check.capture_method || null,
        pago_em: new Date().toISOString()
      }
    });

    // Aviso por e-mail é opcional; se falhar, a venda já está registrada e aparece no painel.
    if (process.env.NOTIFY_EMAIL && process.env.RESEND_API_KEY) {
      try {
        await sendEmail({
          to: process.env.NOTIFY_EMAIL,
          subject: `Nova venda (Criar Site pelo Celular): ${pedido.nome}`,
          html: `<p><b>${escapeHtml(pedido.nome)}</b><br>${escapeHtml(pedido.email)}<br>${escapeHtml(pedido.whatsapp)}</p><p>Abra o painel de vendas para enviar o acesso.</p>`
        });
      } catch (err) { console.error('Falha ao avisar o vendedor', err.message); }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook', orderNsu, err.message);
    return res.status(500).json({ error: 'Erro ao processar. Será reenviado.' });
  }
};
