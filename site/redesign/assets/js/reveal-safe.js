/* ============================================================
   ===== REVEAL-SAFE v2：表示を保証したうえで演出を足す =====

   旧方式の問題
     ・.reveal は既定で opacity:0。JSが is-in を付けないと本文が読めない
     ・「1つでも表示されていれば正常」という全体判定では、
       一部だけ表示され残りが透明のまま残るケースを見逃す

   新方式の7原則
     1. JS無効          … rvon が付かない → 全表示
     2. 初期化成功時のみ … 画面外の要素だけに rv-wait を付けて隠す
     3. IO 非対応        … 何もしない → 全表示
     4. 初期化失敗・例外 … bail() で全解放 → 全表示
     5. 表示漏れ検知     … 要素ごとに判定して個別に救済（全体判定しない）
     6. reduced-motion   … 何もしない → 全表示・動きなし
     7. 印刷             … CSS で全表示 ＋ beforeprint で全解放

   隠す対象は「初期表示時に画面外にあった要素」だけ。
   画面に見えている本文は一度も隠さないため、ちらつきも表示欠落も起きない。
   ============================================================ */
(function(){
  "use strict";

  var root  = document.documentElement;
  var SCOPE = '.rvs-scope';            /* 検証用スコープ。本適用時は外す */
  var SEL   = SCOPE + ' .reveal';
  var MARGIN = 0.92;                   /* 画面高のこの割合より下を「画面外」とする */

  /* --- 3) IntersectionObserver 非対応 → 何もしない（全表示のまま） --- */
  if(!('IntersectionObserver' in window)) return;

  /* --- 6) reduced-motion → 何もしない（全表示・動きなし） --- */
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  }catch(e){ return; }

  var targets = null, waiting = null, io = null, armed = false;

  function finish(el){
    /* フェードの最終状態を確定させる。トランジションが進まない環境では
       rv-in のままだと opacity が途中値で止まるため、必ずここで打ち切る。 */
    if(el) el.classList.add('rv-done');
  }

  function show(el){
    if(!el) return;
    if(el.classList.contains('rv-wait')){
      el.classList.remove('rv-wait');
      el.classList.add('rv-in');
      try{
        el.addEventListener('transitionend', function h(){
          el.removeEventListener('transitionend', h); finish(el);
        });
      }catch(e){}
      setTimeout(function(){ finish(el); }, 900);   /* 背景タブでも setTimeout は発火する */
    }else{
      finish(el);
    }
    el.classList.add('is-in');        /* 既存CSS・既存コードとの互換 */
  }

  function showAll(){
    if(!waiting) return;
    for(var i=0;i<waiting.length;i++) show(waiting[i]);
  }

  /* --- 4) どこで失敗しても必ず全表示へ戻す --- */
  function bail(){
    try{ if(io) io.disconnect(); }catch(e){}
    try{ showAll(); }catch(e){}
    try{
      if(targets) for(var i=0;i<targets.length;i++) targets[i].classList.remove('rv-wait');
    }catch(e){}
    root.classList.remove('rvon');
    armed = false;
  }

  /* --- 5) 表示漏れの検知：要素ごとに判定する（全体判定にしない） ---
         画面にかかっている／通り過ぎたのに隠れたままの要素を個別に救済 */
  function sweep(){
    if(!waiting || !waiting.length) return;
    var vh = window.innerHeight || root.clientHeight || 0;
    var rest = [];
    for(var i=0;i<waiting.length;i++){
      var el = waiting[i];
      if(!el.classList.contains('rv-wait')) continue;
      var r;
      try{ r = el.getBoundingClientRect(); }
      catch(e){ show(el); continue; }
      if(r.top < vh || r.bottom < 0){           /* 画面内 または 通り過ぎた */
        show(el);
        try{ if(io) io.unobserve(el); }catch(e){}
      }else{
        rest.push(el);
      }
    }
    waiting = rest;
  }

  var queued = false;
  function queueSweep(){
    if(queued || !armed) return;
    queued = true;
    var run = function(){ queued = false; try{ sweep(); }catch(e){ bail(); } };
    if(window.requestAnimationFrame){ window.requestAnimationFrame(run); }
    else { window.setTimeout(run, 16); }
  }

  function start(){
    try{
      targets = [].slice.call(document.querySelectorAll(SEL));
      if(!targets.length) return;

      var vh = window.innerHeight || root.clientHeight || 0;
      waiting = [];

      /* --- 2) 画面外の要素だけを隠す。画面内の本文には触れない --- */
      for(var i=0;i<targets.length;i++){
        var r = targets[i].getBoundingClientRect();
        if(r.top >= vh * MARGIN){
          targets[i].classList.add('rv-wait');
          waiting.push(targets[i]);
        }
      }
      if(!waiting.length) return;      /* 全部が画面内 → 演出不要・全表示のまま */

      io = new IntersectionObserver(function(entries){
        for(var k=0;k<entries.length;k++){
          if(entries[k].isIntersecting){
            show(entries[k].target);
            try{ io.unobserve(entries[k].target); }catch(e){}
          }
        }
      }, {threshold:0, rootMargin:'0px 0px -6% 0px'});

      /* ここまで例外なく到達したときだけ、隠す指定を有効化する */
      root.classList.add('rvon');
      armed = true;

      for(var j=0;j<waiting.length;j++) io.observe(waiting[j]);

      /* 戻る操作・タブ切替・リサイズ・回転・印刷 */
      window.addEventListener('scroll', queueSweep, {passive:true});
      window.addEventListener('resize', queueSweep);
      window.addEventListener('orientationchange', queueSweep);
      window.addEventListener('focus', queueSweep);
      window.addEventListener('pageshow', queueSweep);      /* bfcache 復帰 */
      document.addEventListener('visibilitychange', function(){
        if(!document.hidden) queueSweep();
      });
      window.addEventListener('beforeprint', showAll);
      try{
        var mq = window.matchMedia('print');
        if(mq && mq.addListener) mq.addListener(function(m){ if(m.matches) showAll(); });
      }catch(e){}

      /* 画像の遅延読み込み等で高さが変わる場合に備えた再点検 */
      window.addEventListener('load', queueSweep);
      setTimeout(function(){ try{ sweep(); }catch(e){ bail(); } }, 1200);
      setTimeout(function(){ try{ sweep(); }catch(e){ bail(); } }, 4000);

    }catch(e){ bail(); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{
    start();
  }
})();
