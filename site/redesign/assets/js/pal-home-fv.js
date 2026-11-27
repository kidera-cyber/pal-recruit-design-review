/* ============================================================
   ===== PAL-HOME-FV v2 =====
   HOME のファーストビュー専用スクリプト。

   担当するのは次の4つだけ。見た目の定義はすべて CSS 側にある。
     1) ヘッダーの実高さを測って FV の高さに反映する
     2) 文字内動画マスクの描画（ゆっくりしたカメラワークを含む）
     3) 背景レイヤーの奥行き（自動のゆらぎ・マウス追従・スクロール）を
        CSS変数として書き出す
     4) 「アニメーションを停止」の制御

   既存サイトとの分離
     ・全体を IIFE で囲み、グローバル変数を作らない。
     ・要素の取得は .palfv の内側に限定する（document 全体を見ない）。
     ・requestAnimationFrame は1本だけ。描画とパララックスを同じループで扱う。
   ============================================================ */
(function () {
  'use strict';

  var fv = document.querySelector('.palfv');
  if (!fv) return;

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqCoarse = window.matchMedia('(hover: none), (pointer: coarse)');
  var mqNarrow = window.matchMedia('(max-width: 760px)');

  /* ---- ヘッダーの実高さ ----
     ヘッダーは position:sticky で高さが固定値ではないため、CSSに直書きしない。 */
  function syncHeaderHeight() {
    var hdr = document.querySelector('.hdr');
    if (!hdr) return;
    var h = Math.round(hdr.getBoundingClientRect().height);
    if (h > 0) fv.style.setProperty('--palfv-hdr', h + 'px');
  }
  syncHeaderHeight();

  /* ---- 文字内動画マスク ---- */
  var glyphs = Array.prototype.slice.call(fv.querySelectorAll('.palfv__glyph'));
  var videos = {};
  Array.prototype.forEach.call(fv.querySelectorAll('.palfv-media video'), function (v) {
    videos[v.dataset.palfvVideo] = v;
  });
  var btn = fv.querySelector('.palfv__motion');
  if (!glyphs.length || !btn) return;

  /* 文字ごとのカメラワーク。
     3本が同じ動きだと機械的に見えるので、向き・周期・位相をそれぞれ変える。
     base は「どれだけ寄せて描くか」。余白があるぶんだけ平行移動できる。 */
  var CAM = {
    warehouse: { base: 1.14, zoom: 0.034, ax:  0.030, ay:  0.016, per: 14000, ph: 0.0,  seek: 0.0 },
    fde:       { base: 1.15, zoom: 0.045, ax: -0.026, ay:  0.022, per: 17500, ph: 2.1,  seek: 1.1 },
    engineer:  { base: 1.14, zoom: 0.038, ax:  0.022, ay: -0.020, per: 12000, ph: 4.2,  seek: 2.3 }
  };

  /* 3本が同時にループの先頭へ戻ると機械的に見えるため、開始位置をずらす。 */
  Object.keys(videos).forEach(function (k) {
    var v = videos[k], cam = CAM[k];
    if (!v || !cam) return;
    var seek = function () {
      if (!isFinite(v.duration) || v.duration <= 0) return;
      try { v.currentTime = Math.min(cam.seek, v.duration * 0.6); } catch (e) { /* 無視してよい */ }
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener('loadedmetadata', seek, { once: true });
  });

  var reduce = mqReduce.matches;
  var paused = reduce;            // 利用者の意思（停止ボタン・動きを減らす設定）
  var autoPaused = false;         // タブが裏・FVが画面外のときの一時停止
  var OPEN_MS = 950;              // オープニングが終わるまで、文字は黒／赤のまま見せる
  var t0 = performance.now();

  function eachVideo(fn) { Object.keys(videos).forEach(function (k) { fn(videos[k]); }); }

  function applyVideoState() {
    var stop = paused || autoPaused;
    eachVideo(function (v) {
      if (!v) return;
      if (stop) { v.pause(); }
      else {
        var p = v.play();
        /* 自動再生が許可されない環境では reject される。
           その場合も Canvas は最初のフレームを描き続け、
           描けなければ文字はそのまま表示される（CSSの .is-ready を付けない）。 */
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    });
  }

  function update() {
    btn.textContent = paused ? '▶　アニメーションを再生' : 'Ⅱ　アニメーションを停止';
    btn.setAttribute('aria-pressed', String(paused));
    fv.classList.toggle('is-static', paused);
    applyVideoState();
    dirty = true;
  }
  btn.addEventListener('click', function () { paused = !paused; update(); });

  /* ---- 背景レイヤーの奥行き ----
     SVGのユーザー単位は viewBox 1200 幅が基準。画面幅1440なら 1単位 ≒ 1.2px。
     auto は自動のゆらぎ、mouse はマウス追従の最大移動量。 */
  var LAYERS = [
    { k: 'far', ax: 2.5, ay: 1.6, per: 19000, ph: 0.0, mx: 2.5, my: 1.8 },
    { k: 'pla', ax: 4.5, ay: 2.9, per: 15000, ph: 1.3, mx: 5.0, my: 3.4 },
    { k: 'pan', ax: 5.5, ay: 3.5, per: 13000, ph: 2.4, mx: 6.0, my: 4.2 },
    { k: 'cir', ax: 4.5, ay: 2.8, per: 17000, ph: 3.6, mx: 4.5, my: 3.2 },
    { k: 'net', ax: 7.5, ay: 4.6, per: 11000, ph: 0.7, mx: 9.5, my: 6.4 }
  ];
  var mTargetX = 0, mTargetY = 0, mX = 0, mY = 0;
  var useMouse = !mqCoarse.matches && !reduce;
  var lastVar = {};
  var scrollTarget = 0, scrollNow = 0;

  function onMove(e) {
    if (!useMouse || paused) return;
    var r = fv.getBoundingClientRect();
    if (!r.height) return;
    mTargetX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    mTargetY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  }
  function onLeave() { mTargetX = 0; mTargetY = 0; }
  if (useMouse) {
    fv.addEventListener('mousemove', onMove, { passive: true });
    fv.addEventListener('mouseleave', onLeave, { passive: true });
  }

  function setVar(name, value) {
    var s = value.toFixed(2);
    if (lastVar[name] === s) return;
    lastVar[name] = s;
    fv.style.setProperty(name, s + 'px');
  }

  function updateParallax(t) {
    var stop = paused || reduce;
    /* 停止したら、急に飛ばさずゆっくり中央へ戻す */
    var tx = stop ? 0 : mTargetX, ty = stop ? 0 : mTargetY;
    mX += (tx - mX) * 0.055;
    mY += (ty - mY) * 0.055;

    var soft = mqNarrow.matches ? 0.55 : 1;   // スマートフォンは控えめに
    for (var i = 0; i < LAYERS.length; i++) {
      var L = LAYERS[i];
      var ax = stop ? 0 : Math.sin(t / L.per + L.ph) * L.ax;
      var ay = stop ? 0 : Math.cos(t / (L.per * 1.37) + L.ph) * L.ay;
      setVar('--palfv-' + L.k + '-x', (ax + mX * L.mx) * soft);
      setVar('--palfv-' + L.k + '-y', (ay + mY * L.my) * soft);
    }
  }

  function updateScroll() {
    var r = fv.getBoundingClientRect();
    if (!r.height) return;
    var p = Math.max(0, Math.min(1, -r.top / (r.height * 0.85)));
    scrollTarget = reduce ? 0 : p;
    scrollNow += (scrollTarget - scrollNow) * 0.18;
    var s = scrollNow.toFixed(3);
    if (lastVar._sc !== s) { lastVar._sc = s; fv.style.setProperty('--palfv-sc', s); }
  }

  /* ---- 表示状態の監視 ---- */
  var visible = true, dirty = true, running = false;

  function kick() {
    if (!running && visible) { running = true; requestAnimationFrame(frame); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        visible = e.isIntersecting;
        autoPaused = !visible || document.hidden;
        applyVideoState();
        dirty = true;
        kick();
      });
    }, { rootMargin: '120px' }).observe(fv);
  }
  document.addEventListener('visibilitychange', function () {
    autoPaused = document.hidden || !visible;
    applyVideoState();
    dirty = true;
    kick();
  });
  window.addEventListener('resize', function () {
    syncHeaderHeight(); useMouse = !mqCoarse.matches && !reduce; dirty = true; kick();
  }, { passive: true });
  window.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });
  if (mqReduce.addEventListener) {
    mqReduce.addEventListener('change', function (e) {
      reduce = e.matches; paused = reduce; useMouse = !mqCoarse.matches && !reduce; update();
    });
  }

  /* ---- 1本の描画ループ ---- */
  function drawGlyphs(t) {
    var opened = (t - t0) > OPEN_MS;
    for (var i = 0; i < glyphs.length; i++) {
      var el = glyphs[i];
      var key = el.dataset.palfvVideo;
      var v = videos[key], cam = CAM[key] || CAM.warehouse;
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

      /* ゆっくりしたカメラワーク。寄り（base）で作った余白の範囲でしか動かさないため、
         文字マスクの外へ人物や設備が抜けることはない。 */
      var still = paused || autoPaused || reduce;
      var ph = still ? cam.ph : t / cam.per + cam.ph;
      var zoom = cam.base + (still ? cam.zoom * 0.5 : cam.zoom * (0.5 + 0.5 * Math.sin(ph)));
      var scale = Math.max(w / v.videoWidth, h / v.videoHeight) * zoom;
      var iw = v.videoWidth * scale, ih = v.videoHeight * scale;
      var ox = still ? 0 : w * cam.ax * Math.sin(ph * 0.83);
      var oy = still ? 0 : h * cam.ay * Math.cos(ph * 0.61);
      /* 念のため、余白を超えて動かないように内側へ丸める */
      var lx = (iw - w) / 2, ly = (ih - h) / 2;
      ox = Math.max(-lx, Math.min(lx, ox));
      oy = Math.max(-ly, Math.min(ly, oy));

      /* ループの境目で絵が切り替わるのを和らげる（素材側に継ぎ目がある場合の保険） */
      var seam = 1;
      if (!still && isFinite(v.duration) && v.duration > 0.8) {
        var edge = Math.min(v.currentTime, v.duration - v.currentTime);
        if (edge < 0.26) seam = 0.80 + 0.20 * (edge / 0.26);
      }

      ctx.globalAlpha = seam;
      ctx.filter = 'grayscale(100%) contrast(120%) brightness(75%)';
      ctx.drawImage(v, (w - iw) / 2 + ox, (h - ih) / 2 + oy, iw, ih);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;

      ctx.fillStyle = key === 'fde' ? 'rgba(183,0,14,.48)' : 'rgba(0,0,0,.24)';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'destination-in';
      var st = window.getComputedStyle(s);
      ctx.font = st.fontWeight + ' ' + (parseFloat(st.fontSize) * d) + 'px ' + st.fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(s.textContent, w / 2, h * 0.51, w * 0.99);
      ctx.globalCompositeOperation = 'source-over';

      /* オープニングが終わるまでは文字を黒／赤のまま見せ、そのあと映像へ引き継ぐ */
      if (opened) el.classList.add('is-ready');
    }
  }

  function frame(t) {
    if (!visible) { running = false; return; }
    var still = paused || reduce;
    if (!still || dirty) {
      updateParallax(t);
      updateScroll();
      drawGlyphs(t);
      dirty = false;
    } else {
      /* 停止中でも、戻りきっていない間は中央へ寄せ続ける */
      if (Math.abs(mX) > 0.002 || Math.abs(mY) > 0.002 || Math.abs(scrollNow - scrollTarget) > 0.002) {
        updateParallax(t); updateScroll(); drawGlyphs(t);
      }
    }
    requestAnimationFrame(frame);
  }

  update();
  running = true;
  requestAnimationFrame(frame);
})();
/* ===== PAL-HOME-FV v2 END ===== */
