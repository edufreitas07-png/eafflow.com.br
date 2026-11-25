/* =========================================================
   EAF Flow — lead.js
   Formulário de contato: validação, envio ao Supabase (RPC pública
   site_lead_registrar_v1), eventos Meta/GA4 e tela de agradecimento.
   ========================================================= */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://vtxugkwazghjgbjxkjal.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_5_dyhgk5EWZ1EgUAQnVeNA_nx0pgun7';
  var WHATSAPP = '5541984213488';

  var PRODUTOS = {
    menu: 'EAF Menu',
    store: 'EAF Store',
    agenda: 'EAF Agenda'
  };

  var form = document.getElementById('lead-form');
  if (!form) return;

  var box = document.getElementById('lead-box');
  var thanks = document.getElementById('lead-thanks');
  var erroGeral = document.getElementById('lead-erro');
  var botao = document.getElementById('lead-enviar');
  var fixos = form.getAttribute('data-produtos-fixos'); // ex.: "menu" (página do anúncio)

  /* ---------- Menu suspenso de produtos ---------- */
  var drop = document.getElementById('prod-drop');
  var dropBtn = document.getElementById('prod-btn');
  var dropOpts = drop ? drop.querySelectorAll('input[type="checkbox"]') : [];

  function produtosMarcados() {
    if (fixos) return fixos.split(',');
    var lista = [];
    Array.prototype.forEach.call(dropOpts, function (c) { if (c.checked) lista.push(c.value); });
    return lista;
  }

  function atualizarRotulo() {
    if (!dropBtn) return;
    var m = produtosMarcados().map(function (p) { return PRODUTOS[p]; });
    dropBtn.textContent = m.length ? m.join(', ') : 'Escolha o produto';
  }

  if (drop && dropBtn) {
    var preset = (new URLSearchParams(location.search).get('produto') || '').split(',');
    Array.prototype.forEach.call(dropOpts, function (c) { if (preset.indexOf(c.value) !== -1) c.checked = true; });
    atualizarRotulo();
    dropBtn.addEventListener('click', function () {
      var aberto = drop.classList.toggle('open');
      dropBtn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    });
    Array.prototype.forEach.call(dropOpts, function (c) { c.addEventListener('change', atualizarRotulo); });
    document.addEventListener('click', function (e) {
      if (!drop.contains(e.target)) { drop.classList.remove('open'); dropBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- Máscara do WhatsApp ---------- */
  var zapInput = form.elements['whatsapp'];
  zapInput.addEventListener('input', function () {
    var d = zapInput.value.replace(/\D/g, '').slice(0, 11);
    var out = d;
    if (d.length > 6) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
    else if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    zapInput.value = out;
  });

  /* ---------- Validação ---------- */
  function marcar(nome, ok, msg) {
    var campo = form.querySelector('[data-campo="' + nome + '"]');
    if (!campo) return ok;
    campo.classList.toggle('has-error', !ok);
    var e = campo.querySelector('.lp-error');
    if (e && msg) e.textContent = msg;
    return ok;
  }

  function validar() {
    var v = form.elements;
    var okNome = marcar('nome', v['nome'].value.trim().length >= 2, 'Escreva seu nome.');
    var zap = v['whatsapp'].value.replace(/\D/g, '');
    var okZap = marcar('whatsapp', /^[1-9][0-9]9?[0-9]{8}$/.test(zap) && (zap.length === 10 || zap.length === 11), 'Escreva o WhatsApp com DDD. Exemplo: (41) 99999-0000');
    var okNeg = marcar('negocio', v['negocio'].value.trim().length >= 2, 'Escreva o nome do seu negócio.');
    var okCid = marcar('cidade', v['cidade'].value.trim().length >= 2, 'Escreva a cidade.');
    var email = v['email'].value.trim();
    var okMail = marcar('email', !email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), 'Esse e-mail parece estar errado.');
    var okProd = fixos ? true : marcar('produtos', produtosMarcados().length > 0, 'Escolha pelo menos um produto.');
    var okCons = marcar('consent', v['consent'].checked, 'Marque a caixinha para podermos falar com você.');
    return okNome && okZap && okNeg && okCid && okMail && okProd && okCons;
  }

  /* ---------- Origem do anúncio (UTM) ---------- */
  function utm() {
    var p = new URLSearchParams(location.search), o = {}, k;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach(function (n) {
      k = p.get(n); if (k) o[n] = k.slice(0, 120);
    });
    return o;
  }

  /* ---------- Envio ---------- */
  function mostrarErro(txt) { erroGeral.textContent = txt; erroGeral.classList.add('show'); }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    erroGeral.classList.remove('show');
    if (!validar()) {
      var primeiro = form.querySelector('.has-error input, .has-error button');
      if (primeiro) primeiro.focus();
      return;
    }
    var v = form.elements;
    var produtos = produtosMarcados();
    var corpo = {
      p_nome: v['nome'].value.trim(),
      p_whatsapp: v['whatsapp'].value.replace(/\D/g, ''),
      p_negocio: v['negocio'].value.trim(),
      p_cidade: v['cidade'].value.trim(),
      p_email: v['email'].value.trim() || null,
      p_produtos: produtos,
      p_origem: (location.pathname + (document.referrer ? ' < ' + document.referrer : '')).slice(0, 120),
      p_utm: utm(),
      p_consentimento: v['consent'].checked,
      p_hp: v['website'].value || ''
    };
    botao.disabled = true;
    var rotulo = botao.textContent;
    botao.textContent = 'Enviando...';

    fetch(SUPABASE_URL + '/rest/v1/rpc/site_lead_registrar_v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) {
        var m = (res.j && res.j.message) || '';
        if (m.indexOf('whatsapp_invalido') !== -1) throw new Error('Confira o número do WhatsApp, com DDD.');
        if (m.indexOf('muitas_tentativas') !== -1) throw new Error('Muitas tentativas agora. Tente de novo em alguns minutos.');
        throw new Error('Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.');
      }
      concluir(produtos, corpo.p_nome);
    }).catch(function (err) {
      mostrarErro(err && err.message ? err.message : 'Não foi possível enviar agora.');
      botao.disabled = false;
      botao.textContent = rotulo;
    });
  });

  /* ---------- Sucesso: eventos + agradecimento ---------- */
  function concluir(produtos, nome) {
    try {
      if (window.fbq) fbq('track', 'Lead', { content_name: produtos.join(',') });
      if (window.gtag) gtag('event', 'generate_lead', { event_category: 'formulario', event_label: produtos.join(',') });
    } catch (e) {}

    var nomes = produtos.map(function (p) { return PRODUTOS[p]; }).join(' e ');
    var msg = 'Olá! Acabei de enviar meus dados pelo site e tenho interesse no ' + nomes + '.';
    var link = document.getElementById('thanks-zap');
    if (link) link.href = 'https://api.whatsapp.com/send?phone=' + WHATSAPP + '&text=' + encodeURIComponent(msg);
    var h = document.getElementById('thanks-nome');
    if (h) h.textContent = nome.split(' ')[0];

    var cab = document.getElementById('lead-head');
    if (cab) cab.style.display = 'none';
    form.style.display = 'none';
    thanks.classList.add('show');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
