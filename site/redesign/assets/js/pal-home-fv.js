/* ============================================================
   ===== PAL-HOME-FV v1 =====
   HOME のファーストビュー専用スクリプト。
   出典：PAL_recruit_FV_background_v2.html の Canvas 文字マスク処理。

   既存サイトとの分離
     ・全体を IIFE で囲み、グローバル変数を作らない。
     ・要素の取得は .palfv の内側に限定する（document 全体を見ない）。
     ・元データのナビゲーション開閉処理は移植していない。
       ハンバーガーメニューは既存の app.js がそのまま担当する。
   ============================================================ */
(function () {
  'use strict';

  var fv = document.querySelector('.palfv');
  if (!fv) return;

  /* ヘッダーの実高さを測って FV の min-height に反映する。
     ヘッダーは position:sticky で高さが固定値ではないため、CSSに直書きしない。 */
  function syncHeaderHeight() {
    var hdr = document.querySelector('.hdr');
    if (!hdr) return;
    var h = Math.round(hdr.getBoundingClientRect().height);
    if (h > 0) fv.style.setProperty('--palfv-hdr', h + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight, { passive: true });

  /* ---- 文字内動画マスク ---- */
  var glyphs = Array.prototype.slice.call(fv.querySelectorAll('.palfv__glyph'));
  var videos = {};
  Array.prototype.forEach.call(fv.querySelectorAll('.palfv-media video'), function (v) {
    videos[v.dataset.palfvVideo] = v;
  });
  var btn = fv.querySelector('.palfv__motion');
  if (!glyphs.length || !btn) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var paused = reduce;

  function eachVideo(fn) {
    Object.keys(videos).forEach(function (k) { fn(videos[k]); });
  }

  function update() {
    btn.textContent = paused ? '▶　動画を再生' : 'Ⅱ　動画を停止';
    btn.setAttribute('aria-pressed', String(paused));
    eachVideo(function (v) {
      if (paused) { v.pause(); }
      else {
        var p = v.play();
        /* 自動再生が許可されない環境では reject される。
           その場合も Canvas は最初のフレームを描き続け、
           描けなければ文字はそのまま表示される（CSSの .is-ready を付けない）。 */
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    });
  }
  btn.addEventListener('click', function () { paused = !paused; update(); });
  update();

  /* ---- 描画ループ ---- */
  /* FVが画面外にあるときは描画を止める。見た目は変わらない。 */
  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        if (visible && !running) { running = true; requestAnimationFrame(draw); }
      });
    }, { rootMargin: '120px' }).observe(fv);
  }

  var running = true;

  function draw(t) {
    if (!visible) { running = false; return; }
    for (var i = 0; i < glyphs.length; i++) {
      var el = glyphs[i];
      var v = videos[el.dataset.palfvVideo];
      var c = el.querySelector('canvas');
      var s = el.querySelector('span');
      if (!v || !c || !s) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height || v.readyState < 2) continue;

      var d = Math.min(window.devicePixelRatio || 1, 2);
      var cw = Math.round(r.width * d), ch = Math.round(r.height * d);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }

      var ctx = c.getContext('2d');
      var w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);

      var scale = Math.max(w / v.videoWidth, h / v.videoHeight) *
                  (1.10 + (paused ? 0 : 0.025 * Math.sin(t / 3500)));
      var iw = v.videoWidth * scale, ih = v.videoHeight * scale;

      ctx.filter = 'grayscale(100%) contrast(120%) brightness(75%)';
      ctx.drawImage(v, (w - iw) / 2, (h - ih) / 2, iw, ih);
      ctx.filter = 'none';

      ctx.fillStyle = el.dataset.palfvVideo === 'fde' ? 'rgba(183,0,14,.48)' : 'rgba(0,0,0,.24)';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'destination-in';
      var st = window.getComputedStyle(s);
      ctx.font = st.fontWeight + ' ' + (parseFloat(st.fontSize) * d) + 'px ' + st.fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(s.textContent, w / 2, h * 0.51, w * 0.99);
      ctx.globalCompositeOperation = 'source-over';

      el.classList.add('is-ready');
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
/* ===== PAL-HOME-FV v1 END ===== */
