/* ============================================================
   ===== PAL FORM v1：ENTRY / CONTACT フォームの共通処理 =====
   ・入力 → 確認 → 送信（完了ページへ遷移）の3ステップ
   ・送信先は PRM（ローカル）と同一オリジンのときだけ。
     公開プレビュー（GitHub Pages / file:）からは localhost へ接続せず、
     送信もできないことを画面に明示する（受付完了を偽装しない）。
   ・個人情報は localStorage / URL / 計測タグへ出さない。
     計測へ送るのはイベント名と求人コードだけ。
   ============================================================ */
(function (w, d) {
  'use strict';

  /* ---------- 1. 動作モードの判定 ---------- */
  // PRM がローカルで同一オリジン配信している場合のみ「送信できる」
  var host = location.hostname;
  var isLocalHost = (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1');
  var servedByPrm = isLocalHost && location.pathname.indexOf('/recruit/') === 0;
  var API = servedByPrm ? '' : null;   // null = プレビュー（送信不可）

  var PF = w.PALFORM = {
    live: API !== null,
    api: API,
    /** 計測イベント。個人情報は絶対に載せない。 */
    track: function (name, params) {
      try {
        w.dataLayer = w.dataLayer || [];
        var o = { event: name };
        if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) o[k] = params[k];
        w.dataLayer.push(o);
        if (typeof w.gtag === 'function') w.gtag('event', name, params || {});
      } catch (e) { /* 計測失敗は本処理に影響させない */ }
    }
  };

  /* ---------- 2. 小道具 ---------- */
  function $(sel, root) { return (root || d).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); }
  function text(el, v) { if (el) el.textContent = v; }

  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var PHONE_RE = /^[0-9+\-() ]{8,20}$/;
  var KANA_RE = /^[ぁ-ゖァ-ヺー・ｦ-ﾟ\s　ー]+$/;

  function deviceClass() {
    var wd = w.innerWidth || 0;
    return wd < 768 ? 'mobile' : (wd < 1024 ? 'tablet' : 'desktop');
  }

  /** URL の utm_* だけを拾う。個人情報は URL に載せない運用。 */
  function utm() {
    var out = {}, q;
    try { q = new URLSearchParams(location.search); } catch (e) { return out; }
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = q.get(k); if (v) out[k] = String(v).slice(0, 120);
    });
    return out;
  }

  /* ---------- 3. ステップ制御 ---------- */
  function Steps(root) {
    this.root = root;
    this.panes = $$('.pstep', root);
    this.marks = $$('.psteps li', root);
  }
  Steps.prototype.go = function (n) {
    this.panes.forEach(function (p, i) { p.classList.toggle('is-active', i === n); });
    this.marks.forEach(function (m, i) {
      m.classList.toggle('is-current', i === n);
      m.classList.toggle('is-done', i < n);
      m.setAttribute('aria-current', i === n ? 'step' : 'false');
    });
    var h = this.panes[n] && this.panes[n].querySelector('h2,[tabindex="-1"]');
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    var top = this.root.getBoundingClientRect().top + w.pageYOffset - 90;
    w.scrollTo({ top: top < 0 ? 0 : top, behavior: (w.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) ? 'auto' : 'smooth' });
  };

  /* ---------- 4. 検証 ---------- */
  var RULES = {
    name:      { req: true,  msg: 'お名前を入力してください。' },
    name_kana: { req: true,  msg: 'フリガナを入力してください。',
                 test: function (v) { return KANA_RE.test(v); },
                 msg2: 'フリガナは、ひらがなまたはカタカナで入力してください。' },
    email:     { req: true,  msg: 'メールアドレスを入力してください。',
                 test: function (v) { return EMAIL_RE.test(v); },
                 msg2: 'メールアドレスの形式をご確認ください。' },
    phone:     { req: true,  msg: '電話番号を入力してください。',
                 test: function (v) { return PHONE_RE.test(v); },
                 msg2: '電話番号は半角数字とハイフンで入力してください。' },
    category:  { req: true,  msg: 'お問い合わせ種別を選択してください。' },
    body:      { req: true,  msg: 'お問い合わせ内容を入力してください。' },
    consent:   { req: true,  msg: '個人情報の取り扱いへの同意が必要です。' }
  };

  function rowOf(el) { return el.closest ? el.closest('.pform__row') : null; }

  function validateField(el) {
    var name = el.name, rule = RULES[name];
    if (!rule) return true;
    var row = rowOf(el), err = row && $('.pform__err', row);
    var v = (el.type === 'checkbox') ? (el.checked ? 'on' : '') : String(el.value || '').trim();
    var ok = true, msg = '';
    if (rule.req && !v) { ok = false; msg = rule.msg; }
    else if (v && rule.test && !rule.test(v)) { ok = false; msg = rule.msg2 || rule.msg; }
    // 任意項目は未入力なら常に OK
    if (row) {
      row.classList.toggle('is-invalid', !ok);
      if (err) text(err, msg);
    }
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }

  /* ---------- 5. 初期化 ---------- */
  function init() {
    var form = $('#pform');
    if (!form) return;
    var root = form.closest('.pentry') || form.parentNode;
    var steps = new Steps(root);
    var kind = form.getAttribute('data-kind') || 'entry';          // entry | contact
    var jobSlug = form.getAttribute('data-job-slug') || '';
    var jobCode = form.getAttribute('data-job-code') || '';
    var doneUrl = form.getAttribute('data-complete') || 'complete.html';
    var btnNext = $('#pfNext'), btnBack = $('#pfBack'), btnSend = $('#pfSend');
    var errBox = $('#pfError'), errList = $('#pfErrorList');
    var token = null, sending = false, closed = false;

    /* 5-1. プレビュー環境では送信できないことを明示する */
    if (!PF.live) {
      var pv = $('#pfPreview');
      if (pv) pv.hidden = false;
      if (btnSend) { btnSend.disabled = true; btnSend.setAttribute('aria-disabled', 'true'); }
    }

    /* 5-2. ワンタイムトークンの取得（送信可能な環境のみ） */
    function fetchToken() {
      if (!PF.live) return;
      var url = (kind === 'entry')
        ? PF.api + '/api/public/jobs?slug=' + encodeURIComponent(jobSlug)
        : PF.api + '/api/public/form-token';
      fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok && j.token) { token = j.token; return; }
          // 募集が終了・非公開になった求人は、入力の前で止める
          closed = true;
          showErrors(['この求人は現在募集を受け付けていません。最新の募集中求人からお選びください。']);
          if (btnSend) { btnSend.disabled = true; btnSend.setAttribute('aria-disabled', 'true'); }
          if (btnNext) { btnNext.disabled = true; btnNext.setAttribute('aria-disabled', 'true'); }
        })
        .catch(function () { /* 取得できなければ送信時にもう一度試す */ });
    }
    fetchToken();

    /* 5-3. エラー表示 */
    function showErrors(list) {
      if (!errBox || !errList) return;
      errList.innerHTML = '';
      list.forEach(function (m) { var li = d.createElement('li'); li.textContent = m; errList.appendChild(li); });
      errBox.classList.add('is-on');
      errBox.setAttribute('tabindex', '-1');
      try { errBox.focus({ preventScroll: false }); } catch (e) { errBox.focus(); }
      PF.track('form_error', { form_kind: kind, job_code: jobCode || undefined, error_count: list.length });
    }
    function clearErrors() { if (errBox) errBox.classList.remove('is-on'); }

    /* 5-4. 入力中の検証 */
    $$('[name]', form).forEach(function (el) {
      if (el.name === 'company_url') return;
      el.addEventListener('blur', function () { validateField(el); });
      el.addEventListener('change', function () { if (rowOf(el) && rowOf(el).classList.contains('is-invalid')) validateField(el); });
    });

    var started = false;
    form.addEventListener('input', function () {
      if (started) return;
      started = true;
      PF.track(kind === 'entry' ? 'application_form_start' : 'contact_form_start',
               { form_kind: kind, job_code: jobCode || undefined });
    }, true);

    /* 5-5. 値を集める */
    function collect() {
      var o = {};
      $$('[name]', form).forEach(function (el) {
        if (el.type === 'checkbox') { o[el.name] = el.checked ? 'true' : ''; }
        else { o[el.name] = String(el.value || '').trim(); }
      });
      return o;
    }

    /* 5-6. 確認画面を描く */
    function paintConfirm(v) {
      $$('[data-confirm]', root).forEach(function (dd) {
        var k = dd.getAttribute('data-confirm');
        var val = v[k] || '';
        if (k === 'consent') val = v.consent ? '同意する' : '';
        dd.textContent = val;
      });
    }

    /* 5-7. 入力 → 確認 */
    if (btnNext) btnNext.addEventListener('click', function () {
      if (closed) return;
      clearErrors();
      var bad = [];
      $$('[name]', form).forEach(function (el) {
        if (el.name === 'company_url') return;
        if (!validateField(el)) {
          var row = rowOf(el), e = row && $('.pform__err', row);
          if (e && e.textContent) bad.push(e.textContent);
        }
      });
      if (bad.length) {
        showErrors(bad);
        var first = $('.pform__row.is-invalid [name]', form);
        if (first) try { first.focus(); } catch (e) { }
        return;
      }
      paintConfirm(collect());
      steps.go(1);
      PF.track(kind === 'entry' ? 'application_form_confirm' : 'contact_form_confirm',
               { form_kind: kind, job_code: jobCode || undefined });
    });

    /* 5-8. 確認 → 入力へ戻る */
    if (btnBack) btnBack.addEventListener('click', function () { clearErrors(); steps.go(0); });

    /* 5-9. 送信 */
    if (btnSend) btnSend.addEventListener('click', function () {
      if (sending || !PF.live) return;
      clearErrors();
      sending = true;
      btnSend.disabled = true;                      // 二重送信防止
      var label = btnSend.textContent;
      btnSend.textContent = '送信中…';

      function fail(list) {
        sending = false;
        btnSend.disabled = false;
        btnSend.textContent = label;
        showErrors(list);
      }

      var send = function () {
        var v = collect();
        var payload = {
          token: token,
          name: v.name, name_kana: v.name_kana, email: v.email, phone: v.phone,
          consent: v.consent ? 'true' : '', company_url: v.company_url || '',
          referrer: d.referrer ? String(d.referrer).slice(0, 200) : '',
          device: deviceClass()
        };
        if (kind === 'entry') {
          payload.job_slug = jobSlug;
          payload.heard_from = v.heard_from || '';
          payload.note = v.note || '';
        } else {
          payload.category = v.category || '';
          payload.job_slug = v.job_slug || '';
          payload.body = v.body || '';
        }
        var u = utm();
        for (var k in u) if (Object.prototype.hasOwnProperty.call(u, k)) payload[k] = u[k];

        var ep = PF.api + (kind === 'entry' ? '/api/public/applications' : '/api/public/inquiries');
        fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) {
          return r.json().then(function (j) { return { status: r.status, body: j }; });
        }).then(function (res) {
          var j = res.body || {};
          if (!j.ok) {
            if (res.status === 409) { token = null; fetchToken(); }
            fail(j.errors && j.errors.length ? j.errors : [j.message || '送信できませんでした。時間をおいてもう一度お試しください。']);
            return;
          }
          // 受付番号だけを一時保存する（個人情報は保存しない／localStorage は使わない）
          try {
            sessionStorage.setItem('pal_reception', JSON.stringify({
              kind: kind, code: j.receptionCode || '',
              job: (j.job && j.job.occupation) || '', jobCode: (j.job && j.job.jobCode) || jobCode || '',
              category: j.category || ''
            }));
          } catch (e) { /* 使えなくても完了ページは表示する */ }
          PF.track(kind === 'entry' ? 'application_form_submit' : 'contact_form_submit',
                   { form_kind: kind, job_code: jobCode || undefined });
          location.href = doneUrl;
        }).catch(function () {
          fail(['送信できませんでした。通信の状態を確認して、もう一度お試しください。']);
        });
      };

      if (!token) { fetchToken(); setTimeout(function () { token ? send() : fail(['受付の準備ができていません。ページを再読み込みしてお試しください。']); }, 700); }
      else send();
    });

    // Enter キーでの意図しない送信を防ぐ（textarea は除く）
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') e.preventDefault();
    });
  }

  /* ---------- 6. 完了ページ ---------- */
  function initDone() {
    var box = $('#pfDone');
    if (!box) return;
    var data = null;
    try {
      var s = sessionStorage.getItem('pal_reception');
      if (s) { data = JSON.parse(s); sessionStorage.removeItem('pal_reception'); }
    } catch (e) { }
    var codeEl = $('#pfDoneCode'), jobEl = $('#pfDoneJob');
    if (data && data.code && data.code !== 'ignored') {
      if (codeEl) { codeEl.textContent = data.code; codeEl.parentNode.hidden = false; }
      if (jobEl && (data.job || data.category)) { jobEl.textContent = data.job || data.category; jobEl.parentNode.hidden = false; }
      PF.track(data.kind === 'contact' ? 'contact_complete' : 'apply_complete',
               { job_code: data.jobCode || undefined });
    }
    // 受付番号がない（直接開かれた）場合は、番号欄を出さないだけで本文は表示する
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { init(); initDone(); });
  else { init(); initDone(); }
})(window, document);
