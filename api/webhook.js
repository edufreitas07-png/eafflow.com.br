// Recebe o aviso da InfinitePay, confirma o pagamento e avisa o vendedor (notificação no celular).
// O aviso não é assinado: nada é aceito só com base nele. Cada um é confirmado em /payment_check.
// A entrega do curso é manual: o vendedor toca em "Enviar acesso" no painel.
const { sb, avisarAparelhos } = require('./_lib');

const PAYMENT_CHECK = 'https://api.checkout.infinitepay.io/payment_check';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) return res.status(500).json({ error: 'Servidor sem configuração.' });
  const price = parseInt(process.env.PRICE_CENTS || '1000', 10);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { order_nsu: orderNsu, transaction_nsu: transactionNsu, invoice_slug: slug } = body;
  if (!orderNsu || !transactionNsu || !slug) return res.status(400).json({ error: 'Aviso incompleto.' });

  try {
    const enc = encodeURIComponent(orderNsu);
    const pedidos = await sb(`curso_site_pedidos?order_nsu=eq.${enc}&select=*`);
    const pedido = pedidos && pedidos[0];
    if (!pedido) return res.status(400).json({ error: 'Pedido desconhecido.' });

    // Já tratado: responde 200 para a InfinitePay parar de reenviar, sem avisar de novo.
    if (pedido.status === 'pago' || pedido.status === 'entregue') return res.status(200).json({ ok: true, repetido: true });

    const chk = await fetch(PAYMENT_CHECK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, order_nsu: orderNsu, transaction_nsu: transactionNsu, slug })
    });
    const check = await chk.json().catch(() => ({}));
    if (!chk.ok) throw new Error(`payment_check HTTP ${chk.status}`);
    if (!check.success || !check.paid) return res.status(400).json({ error: 'Pagamento não confirmado.' });
    if (check.amount !== price) return res.status(400).json({ error: 'Valor da cobrança diferente do esperado.' });

    // Só marca como pago se ainda estava "criado": evita aviso duplicado em reenvios simultâneos.
    const marcado = await sb(`curso_site_pedidos?order_nsu=eq.${enc}&status=eq.criado`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: {
        status: 'pago',
        transaction_nsu: transactionNsu,
        forma_pagamento: check.capture_method || null,
        pago_em: new Date().toISOString()
      }
    });
    if (marcado && marcado.length) {
      const primeiro = String(pedido.nome).trim().split(/\s+/)[0];
      await avisarAparelhos({
        titulo: 'Nova venda! 💰',
        corpo: `${pedido.nome} comprou o curso. Toque para enviar o acesso.`,
        tag: `venda-${orderNsu}`,
        url: '/vendas/',
        nome: primeiro
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro no webhook', orderNsu, err.message);
    return res.status(500).json({ error: 'Erro ao processar. Será reenviado.' });
  }
};
