/* =========================================================
   EAF Flow — contatos.js
   Painel de contatos (só super admin). Login pelo Supabase Auth,
   leitura e "Já chamei" pelas RPCs site_leads_listar_v1 e
   site_lead_marcar_chamado_v1.
   ========================================================= */
(function () {
  'use strict';

  var URL = 'https://vtxugkwazghjgbjxkjal.supabase.co';
  var KEY = 'sb_publishable_5_dyhgk5EWZ1EgUAQnVeNA_nx0pgun7';
  var NOMES = { menu: 'EAF Menu', store: 'EAF Store', agenda: 'EAF Agenda' };

  var token = null, leads = [], filtro = 'faltam';
  var $ = function (id) { return document.getElementById(id); };

  function guardar(t) { try { if (t) sessionStorage.setItem('eaf_ct', t); else sessionStorage.removeItem('eaf_ct'); } catch (e) {} }
  function lerGuardado() { try { return sessionStorage.getItem('eaf_ct'); } catch (e) { return null; } }

  function api(path, opts) {
    opts = opts || {};
    var h = { 'Content-Type': 'application/json', 'apikey': KEY };
    h['Authorization'] = 'Bearer ' + (opts.token || KEY);
    return fetch(URL + path, { method: opts.method || 'POST', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); });
  }

  function mostrarLogin(msg) {
    $('ct-painel').style.display = 'none';
    $('ct-login').style.display = '';
    var e = $('ct-erro');
    if (msg) { e.textContent = msg; e.classList.add('show'); } else { e.classList.remove('show'); }
  }

  function mostrarPainel() {
    $('ct-login').style.display = 'none';
    $('ct-painel').style.display = '';
  }

  function carregar() {
    return api('/rest/v1/rpc/site_leads_listar_v1', { token: token, body: {} }).then(function (r) {
      if (r.status === 401 || r.status === 403 || (r.j && r.j.code === '42501')) {
        guardar(null); token = null;
        mostrarLogin(r.status === 403 || (r.j && r.j.code === '42501') ? 'Esse login não tem permissão para ver os contatos.' : 'Sua sessão acabou. Entre de novo.');
        return;
      }
      if (!r.ok) { alert('Não foi possível carregar agora.'); return; }
      leads = r.j || [];
      mostrarPainel();
      desenhar();
    });
  }

  function dataBr(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function foneBonito(z) {
    return z.length === 11 ? '(' + z.slice(0, 2) + ') ' + z.slice(2, 7) + '-' + z.slice(7) : '(' + z.slice(0, 2) + ') ' + z.slice(2, 6) + '-' + z.slice(6);
  }

  function desenhar() {
    var faltam = leads.filter(function (l) { return !l.chamado; });
    var feitos = leads.filter(function (l) { return l.chamado; });
    $('n-faltam').textContent = '(' + faltam.length + ')';
    $('n-feitos').textContent = '(' + feitos.length + ')';
    $('n-todos').textContent = '(' + leads.length + ')';
    var lista = filtro === 'faltam' ? faltam : filtro === 'feitos' ? feitos : leads;
    var box = $('ct-lista');
    box.textContent = '';
    if (!lista.length) {
      var v = document.createElement('div'); v.className = 'ct-vazio';
      v.textContent = filtro === 'faltam' ? 'Nenhum contato esperando. Tudo chamado!' : 'Nada por aqui ainda.';
      box.appendChild(v); return;
    }
    lista.forEach(function (l) { box.appendChild(cartao(l)); });
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function cartao(l) {
    var c = el('article', 'ct-item' + (l.chamado ? ' feito' : ''));
    var r1 = el('div', 'ct-row');
    r1.appendChild(el('div', 'ct-nome', l.nome));
    r1.appendChild(el('div', 'ct-data', dataBr(l.criado_em)));
    c.appendChild(r1);
    c.appendChild(el('div', 'ct-info', l.negocio + ' · ' + l.cidade));
    var chips = el('div', 'ct-chips');
    (l.produtos || []).forEach(function (p) { chips.appendChild(el('span', 'ct-chip', NOMES[p] || p)); });
    c.appendChild(chips);
    var info = foneBonito(l.whatsapp) + (l.email ? ' · ' + l.email : '');
    c.appendChild(el('div', 'ct-info', info));
    if (l.chamado && l.chamado_em) c.appendChild(el('div', 'ct-data', 'Chamado em ' + dataBr(l.chamado_em)));

    var ac = el('div', 'ct-acoes');
    var nomes = (l.produtos || []).map(function (p) { return NOMES[p] || p; }).join(' e ');
    var msg = 'Olá, ' + l.nome.split(' ')[0] + '! Aqui é o Eduardo, da EAF Flow. Vi que você pediu informações sobre o ' + nomes + '. Posso te explicar como funciona?';
    var z = el('a', 'ct-btn zap', 'WhatsApp');
    z.href = 'https://api.whatsapp.com/send?phone=55' + l.whatsapp + '&text=' + encodeURIComponent(msg);
    z.target = '_blank'; z.rel = 'noopener';
    ac.appendChild(z);
    var b = el('button', 'ct-btn' + (l.chamado ? '' : ' ok'), l.chamado ? 'Desmarcar' : 'Já chamei');
    b.type = 'button';
    b.addEventListener('click', function () { marcar(l, !l.chamado, b); });
    ac.appendChild(b);
    c.appendChild(ac);
    return c;
  }

  function marcar(l, valor, btn) {
    btn.disabled = true;
    api('/rest/v1/rpc/site_lead_marcar_chamado_v1', { token: token, body: { p_id: l.id, p_chamado: valor } }).then(function (r) {
      if (!r.ok) { btn.disabled = false; alert('Não foi possível salvar. Tente de novo.'); return; }
      l.chamado = valor; l.chamado_em = valor ? new Date().toISOString() : null;
      desenhar();
    });
  }

  $('ct-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('ct-email').value.trim(), senha = $('ct-senha').value;
    if (!email || !senha) { mostrarLogin('Escreva o e-mail e a senha.'); return; }
    api('/auth/v1/token?grant_type=password', { body: { email: email, password: senha } }).then(function (r) {
      if (!r.ok || !r.j || !r.j.access_token) { mostrarLogin('E-mail ou senha incorretos.'); return; }
      token = r.j.access_token; guardar(token);
      $('ct-senha').value = '';
      carregar();
    });
  });

  $('ct-tabs').addEventListener('click', function (ev) {
    var b = ev.target.closest('.ct-tab'); if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(document.querySelectorAll('.ct-tab'), function (t) { t.classList.toggle('on', t === b); });
    desenhar();
  });
  $('ct-atualizar').addEventListener('click', carregar);
  $('ct-sair').addEventListener('click', function () { guardar(null); token = null; leads = []; mostrarLogin(); });

  token = lerGuardado();
  if (token) carregar(); else mostrarLogin();
})();
