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
