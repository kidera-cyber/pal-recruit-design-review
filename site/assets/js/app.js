/* 株式会社PAL 採用サイト 共通JS（メニュー開閉・タブ切替・求人フィルター・FAQ） */
(function(){
  "use strict";

  /* ---- ハンバーガーメニュー ---- */
  var toggle = document.getElementById('navToggle');
  var drawer = document.getElementById('drawer');
  if(toggle && drawer){
    toggle.addEventListener('click', function(){
      var open = drawer.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true':'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    drawer.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded','false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- 汎用タブ（role="tablist" / role="tab" / role="tabpanel"） ----
     1ページに複数のタブグループがあっても、それぞれ独立して動作する。 */
  function initTabGroup(root){
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    if(!tabs.length) return;
    var panels = tabs.map(function(t){
      var id = t.getAttribute('aria-controls');
      return id ? document.getElementById(id) : null;
    });
    root.classList.add('is-js');

    function select(i, opts){
      opts = opts || {};
      tabs.forEach(function(t,n){
        var on = (n===i);
        t.setAttribute('aria-selected', on ? 'true':'false');
        t.tabIndex = on ? 0 : -1;
        if(panels[n]){
          if(on){ panels[n].classList.add('is-active'); panels[n].removeAttribute('hidden'); }
          else { panels[n].classList.remove('is-active'); panels[n].setAttribute('hidden',''); }
        }
      });
      if(opts.focus) tabs[i].focus();
    }
    tabs.forEach(function(t,i){
      t.addEventListener('click', function(){ select(i); });
      t.addEventListener('keydown', function(e){
        var k = e.key, n = -1;
        if(k==='ArrowRight'||k==='ArrowDown') n=(i+1)%tabs.length;
        else if(k==='ArrowLeft'||k==='ArrowUp') n=(i-1+tabs.length)%tabs.length;
        else if(k==='Home') n=0;
        else if(k==='End') n=tabs.length-1;
        if(n<0) return;
        e.preventDefault(); select(n,{focus:true});
      });
    });
    // 初期状態：aria-selected="true" が付いているタブを表示、それ以外のパネルをhiddenに
    var initial = 0;
    tabs.forEach(function(t,n){ if(t.getAttribute('aria-selected')==='true') initial = n; });
    select(initial);
  }
  document.querySelectorAll('[role="tablist"]').forEach(function(list){
    // tablist要素自身を起点に初期化する（入れ子のtablistが混ざらないようにするため）
    initTabGroup(list);
  });

  /* ---- 汎用：URLハッシュに対応するタブを自動展開 ----
     WORK（#role-xxx）・CAREER（#cp-xxx）など、ページ内にある
     role="tab" を持つタブはすべてこの1つの処理で対応する。
     タブの aria-controls 属性とハッシュが一致するタブを探して開く方式のため、
     ページ固有のID決め打ちをせず、将来タブが増えても追加修正が不要。
     旧: WORKページの #rolepick だけを対象にしたハッシュ処理だったため、
         CAREERページの #cp-xxx はハッシュを開いても該当タブが開かない不具合があった。
     修正: 対象を全ページの全タブグループに拡張し、WORK・CAREER両方で動作するようにした。 ---- */
  (function(){
    var ALIAS = {'role-bizdev':'role-sales'}; // 旧IDの読み替え（WORKのBizDev統合分）
    function openFromHash(){
      var id = (location.hash||'').replace('#','');
      if(!id) return;
      id = ALIAS[id] || id;
      var tab = document.querySelector('[role="tab"][aria-controls="'+id+'"]');
      if(!tab) return;
      tab.click();
      var panel = document.getElementById(id);
      if(panel){
        var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
        setTimeout(function(){
          var y = panel.getBoundingClientRect().top + window.pageYOffset - 96;
          window.scrollTo(reduce ? {top:y} : {top:y, behavior:'smooth'});
        }, 30);
      }
    }
    window.addEventListener('hashchange', openFromHash);
    if(location.hash) openFromHash();
  })();

  /* ---- JOBS：職種・勤務地フィルター ---- */
  (function(){
    var root = document.getElementById('joblist');
    if(!root) return;
    root.classList.add('is-js');
    var btns = [].slice.call(root.querySelectorAll('.jfil__b'));
    var cards = [].slice.call(root.querySelectorAll('.jcard'));
    var groups = [].slice.call(root.querySelectorAll('.jgroup'));
    var countEl = document.getElementById('jobcount');
    var state = {category:'all', location:'all'};
    function apply(){
      var n = 0;
      cards.forEach(function(c){
        var cat = c.getAttribute('data-job-category');
        var loc = c.getAttribute('data-location');
        var ok = (state.category==='all'||cat===state.category) &&
                 (state.location==='all'||loc===state.location);
        c.hidden = !ok; if(ok) n++;
      });
      groups.forEach(function(g){
        var vis = [].slice.call(g.querySelectorAll('.jcard')).some(function(c){return !c.hidden;});
        g.hidden = !vis;
      });
      btns.forEach(function(b){
        var cat = b.getAttribute('data-filter-category');
        var loc = b.getAttribute('data-filter-location');
        if(cat){ b.classList.toggle('is-active', state.category===cat); b.setAttribute('aria-pressed', state.category===cat?'true':'false'); }
        if(loc){ b.classList.toggle('is-active', state.location===loc); b.setAttribute('aria-pressed', state.location===loc?'true':'false'); }
      });
      if(countEl) countEl.textContent = n;
      var none = document.getElementById('jobnone');
      if(none) none.hidden = (n>0);
    }
    btns.forEach(function(b){
      b.addEventListener('click', function(){
        var cat = b.getAttribute('data-filter-category');
        var loc = b.getAttribute('data-filter-location');
        if(cat) state.category = cat;
        if(loc) state.location = loc;
        apply();
      });
    });
    apply();
  })();

  /* ---- FAQ：カテゴリタブ・職種タブはinitTabGroupで対応済み ---- */

  /* ---- スクロール時のヘッダー追従CTA表示切り替え（任意演出・最小限） ---- */
  var sidecta = document.getElementById('sideCta');
  if(sidecta){
    var hero = document.querySelector('.hero, .hero-v2, .phead');
    if(hero){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          sidecta.style.opacity = en.isIntersecting ? '0' : '1';
          sidecta.style.pointerEvents = en.isIntersecting ? 'none' : 'auto';
        });
      },{threshold:0});
      io.observe(hero);
    }
  }
})();

/* ============================================================
   ===== REVEAL-SAFE v2：表示を保証したうえで演出を足す =====
   旧方式: .reveal{opacity:0} が既定。JSが is-in を付けないと本文が読めない。
   新方式: 既定は可視。JSの初期化が成功したときだけ、
           「初期表示で画面外にあった要素」に限って隠し、スクロールで表示する。

     1. JS無効            … rvon が付かない → 全表示
     2. 初期化成功時のみ  … 画面外の要素だけ rv-wait を付けて隠す
     3. IO 非対応         … 何もしない → 全表示
     4. 初期化失敗・例外  … bail() で全解放 → 全表示
     5. 表示漏れ検知      … 要素ごとに判定して個別に救済（全体判定しない）
     6. reduced-motion    … 何もしない → 全表示・動きなし
     7. 印刷              … CSS で全表示 ＋ beforeprint で全解放

   各ページにあったインライン IntersectionObserver は削除し、
   ここに一本化している（二重動作の解消）。
   ============================================================ */
(function(){
  "use strict";

  var root   = document.documentElement;
  var SEL    = '.reveal,.reveal-stagger';
  var MARGIN = 1.0;               /* 画面の下端より下に始まる要素だけを「画面外」とする */

  if(!('IntersectionObserver' in window)) return;          /* 3 */
  try{
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;  /* 6 */
  }catch(e){ return; }

  var targets = null, waiting = null, io = null, armed = false;

  function finish(el){ if(el) el.classList.add('rv-done'); }

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
    el.classList.add('is-in');      /* 既存CSS（.reveal.is-in）との互換 */
  }

  function showAll(){
    if(!waiting) return;
    for(var i=0;i<waiting.length;i++) show(waiting[i]);
  }

  function bail(){                                          /* 4 */
    try{ if(io) io.disconnect(); }catch(e){}
    try{ showAll(); }catch(e){}
    try{
      if(targets) for(var i=0;i<targets.length;i++) targets[i].classList.remove('rv-wait');
    }catch(e){}
    root.classList.remove('rvon');
    armed = false;
  }

  function sweep(){                                         /* 5 */
    if(!waiting || !waiting.length) return;
    var vh = window.innerHeight || root.clientHeight || 0;
    var rest = [];
    for(var i=0;i<waiting.length;i++){
      var el = waiting[i];
      if(!el.classList.contains('rv-wait')) continue;
      var r;
      try{ r = el.getBoundingClientRect(); }catch(e){ show(el); continue; }
      if(r.top < vh || r.bottom < 0){
        show(el);
        try{ if(io) io.unobserve(el); }catch(e){}
      }else{ rest.push(el); }
    }
    waiting = rest;
  }

  var queued = false;
  function queueSweep(){
    if(queued || !armed) return;
    queued = true;
    var run = function(){ queued = false; try{ sweep(); }catch(e){ bail(); } };
    /* requestAnimationFrame は背景タブ・省電力・スクリーンショット環境では
       発火しないことがある（document.hidden が false でも起きる）。
       setTimeout を併走させ、先に動いたほうが処理する。
       sweep は何度呼んでも同じ結果になるので、二重に動いても害はない。 */
    if(window.requestAnimationFrame){ window.requestAnimationFrame(run); }
    window.setTimeout(run, 120);
  }

  function start(){
    try{
      /* 0. このページが新方式を選んでいなければ何もしない。
         .rvs-scope を持たないページ（site/ 直下の47ページ、未移行のredesignページ）は
         従来どおりページ内のスクリプトで動くため、挙動は1つも変わらない。 */
      if(!document.querySelector('.rvs-scope')) return;

      targets = [].slice.call(document.querySelectorAll(SEL));
      if(!targets.length) return;

      var vh = window.innerHeight || root.clientHeight || 0;
      waiting = [];
      for(var i=0;i<targets.length;i++){                    /* 2 */
        var r = targets[i].getBoundingClientRect();
        if(r.top >= vh * MARGIN){
          targets[i].classList.add('rv-wait');
          waiting.push(targets[i]);
        }
      }
      if(!waiting.length) return;   /* 全部が画面内 → 演出不要・全表示のまま */

      io = new IntersectionObserver(function(entries){
        for(var k=0;k<entries.length;k++){
          if(entries[k].isIntersecting){
            show(entries[k].target);
            try{ io.unobserve(entries[k].target); }catch(e){}
          }
        }
      }, {threshold:0, rootMargin:'0px 0px -6% 0px'});

      root.classList.add('rvon');
      armed = true;
      for(var j=0;j<waiting.length;j++) io.observe(waiting[j]);

      window.addEventListener('scroll', queueSweep, {passive:true});
      window.addEventListener('resize', queueSweep);
      window.addEventListener('orientationchange', queueSweep);
      window.addEventListener('focus', queueSweep);
      window.addEventListener('pageshow', queueSweep);      /* 戻る操作 */
      document.addEventListener('visibilitychange', function(){
        if(!document.hidden) queueSweep();
      });
      window.addEventListener('beforeprint', showAll);      /* 7 */
      try{
        var mq = window.matchMedia('print');
        if(mq && mq.addListener) mq.addListener(function(m){ if(m.matches) showAll(); });
      }catch(e){}
      window.addEventListener('load', queueSweep);
      setTimeout(function(){ try{ sweep(); }catch(e){ bail(); } }, 1200);
      setTimeout(function(){ try{ sweep(); }catch(e){ bail(); } }, 4000);

      /* 最後の保険：scroll も IntersectionObserver も rAF も動かない環境でも、
         定期的に位置を見て、画面に入った要素を表示する。
         隠している要素が無くなったら自分で止まるので、動き続けることはない。 */
      var tick = setInterval(function(){
        if(!armed || !waiting || !waiting.length){ clearInterval(tick); return; }
        try{ sweep(); }catch(e){ bail(); clearInterval(tick); }
      }, 1500);

    }catch(e){ bail(); }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  }else{ start(); }
})();
/* ===== REVEAL-SAFE v2 END ===== */
