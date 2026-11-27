// Cria o link de pagamento (InfinitePay) do curso "Criar Site pelo Celular".
// Variáveis: INFINITEPAY_HANDLE, SITE_URL (https://eafflow.com.br), SUPABASE_URL, SUPABASE_SERVICE_KEY.
// Opcionais: PRICE_CENTS_SITE (padrão 1000 = R$ 10,00), PRODUCT_NAME_SITE.
const { sb } = require('./_lib');

const CHECKOUT_API = 'https://api.checkout.infinitepay.io/links';
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const handle = process.env.INFINITEPAY_HANDLE;
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (!handle || !siteUrl) return res.status(500).json({ error: 'Servidor sem configuração de pagamento.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const nome = String(body.nome || '').trim();
  const email = String(body.email || '').trim();
  const whatsapp = soDigitos(body.whatsapp);
  if (nome.length < 2) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (whatsapp.length < 10 || whatsapp.length > 13) return res.status(400).json({ error: 'WhatsApp inválido. Use DDD + número.' });

  const price = parseInt(process.env.PRICE_CENTS_SITE || '1000', 10);
  const nomeProduto = process.env.PRODUCT_NAME_SITE || 'Curso Criar Site pelo Celular';
  const orderNsu = `site-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const telefone = whatsapp.startsWith('55') ? `+${whatsapp}` : `+55${whatsapp}`;

  try {
    await sb('curso_pedidos', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { order_nsu: orderNsu, nome, email, whatsapp: telefone, status: 'criado' }
    });
  } catch (err) {
    console.error('Erro ao gravar pedido', err.message);
    return res.status(500).json({ error: 'Não foi possível iniciar a compra. Tente de novo.' });
  }

  try {
    const resp = await fetch(CHECKOUT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        order_nsu: orderNsu,
        redirect_url: `${siteUrl}/obrigado-site.html`,
        webhook_url: `${siteUrl}/api/webhook`,
        items: [{ quantity: 1, price, description: nomeProduto }],
        customer: { name: nome, email, phone_number: telefone }
      })
    });
    const texto = await resp.text();
    let json; try { json = JSON.parse(texto); } catch { json = {}; }
    const url = json.url || json.checkout_url || json.link || json.payment_url;
    if (!resp.ok || !url) {
      console.error('InfinitePay respondeu', resp.status, texto);
      return res.status(502).json({ error: 'Não foi possível gerar o pagamento. Tente de novo.' });
    }
    return res.status(200).json({ url, order_nsu: orderNsu });
  } catch (err) {
    console.error('Erro ao chamar InfinitePay', err);
    return res.status(502).json({ error: 'Falha de conexão com o pagamento.' });
  }
};
