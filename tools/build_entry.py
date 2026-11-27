#!/usr/bin/env python3
# ============================================================
# ===== build_entry v1 =====
# 共通テンプレート＋求人データ（site/redesign/entry/jobs.json）から
#   ・entry/index.html            エントリー一覧（職種・勤務地・雇用形態で絞り込み）
#   ・entry/<slug>.html           求人ごとの専用エントリーページ（12件）
#   ・entry/complete.html         応募受付の完了ページ
#   ・contact.html                採用に関するお問い合わせ
#   ・contact-complete.html       お問い合わせ受付の完了ページ
# を生成する。jobs.json は PRM の app/scripts/export-site-jobs.mjs が書き出す。
#
# 応募フォームの項目は、必須＝氏名／フリガナ／メールアドレス／電話番号／個人情報同意、
# 任意＝PALを知ったきっかけ／その他連絡事項 のみ。
# 履歴書・職務経歴書・学歴・年収・生年月日などの項目と
# ファイル添付の仕組みは、HTML にも JS にも持たせない。
#
#   使い方:  python3 -I tools/build_entry.py          生成
#            python3 -I tools/build_entry.py --check  生成物と現在のファイルの一致を確認
# ============================================================
import json, html, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _opt(name, default):
    """--name <値> を取り出す。指定がなければ default。"""
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


# --root で出力先を差し替えられる（PRM の公開処理が検証用サイトへ生成するために使う）
SITE = os.path.abspath(_opt('--root', os.path.join(ROOT, 'site', 'redesign')))
DATA = os.path.abspath(_opt('--data', os.path.join(SITE, 'entry', 'jobs.json')))
CHECK = '--check' in sys.argv
JSON_OUT = '--json' in sys.argv      # 結果を JSON で出す（PRM から呼ぶとき）

E = html.escape

# ---------- 共通チャンク ----------------------------------------------------

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900'
         '&family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">')

NAV = [('home.html', 'ホーム', 'HOME'), ('about.html', 'PALを知る', 'ABOUT'),
       ('work.html', '仕事を知る', 'WORK'), ('people.html', '人を知る', 'PEOPLE'),
       ('career.html', 'キャリア', 'CAREER'), ('jobs.html', '募集職種', 'JOBS'),
       ('faq.html', 'FAQ', 'Q&amp;A')]

LOGO_IMG = ('<span class="logo__plate"><img class="logo__img" src="{a}assets/images/pal-logo.webp" '
            'srcset="{a}assets/images/pal-logo-240.webp 240w, {a}assets/images/pal-logo.webp 600w" '
            'sizes="(max-width:760px) 62px, 70px" width="600" height="240" alt="" decoding="async">'
            '</span><span class="logo__txt">RECRUIT<small>株式会社PAL 採用サイト</small></span>')


def head(depth, title, desc, canonical, extra=''):
    """depth: redesign/ から何階層下か（0 = redesign 直下）"""
    p = '../' * depth                 # redesign/ への相対
    a = '../' * (depth + 1)           # site/assets/ への相対
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{canonical}">
{FONTS}
<link rel="stylesheet" href="{a}assets/css/style.css?v=logo1">
<link rel="stylesheet" href="{p}assets/css/system-h.css">
<!-- ===== WHITE-EDITORIAL v1：採用サイト共通の白基調デザイン（A案）。 ===== -->
<link rel="stylesheet" href="{p}assets/css/white-editorial.css?v=5">
<!-- ===== PAL FORM v1：ENTRY / CONTACT のフォーム専用スタイル ===== -->
<link rel="stylesheet" href="{p}assets/css/pal-form.css?v=1">
{extra}<style>
.proto-bar{{background:#000;color:#fff;padding:10px 20px;font-size:12.5px;text-align:center;position:relative;z-index:600}}
.proto-bar b{{color:#ff8186}}
@media (prefers-reduced-motion:reduce){{ .reveal{{opacity:1!important;transform:none!important}} }}
</style>
</head>'''


def header(depth, bar, current=None):
    p = '../' * depth
    a = '../' * (depth + 1)
    gnav, drawer = [], []
    for href, ja, en in NAV:
        cur = ' aria-current="page" class="is-current"' if href == current else ''
        gnav.append(f'      <a href="{p}{href}"{cur}>{ja}<small>{en}</small></a>')
        drawer.append(f'  <a href="{p}{href}"{cur}>{ja}<span>{en}</span></a>')
    nl = '\n'
    return f'''<body class="we">
<div class="proto-bar">{bar}</div>
<a class="skip-link" href="#main">本文へスキップ</a>
<header class="hdr" id="hdr">
  <div class="hdr__inner">
    <a class="logo" href="{p}home.html" aria-label="PAL RECRUIT トップへ">{LOGO_IMG.format(a=a)}</a>
    <nav class="gnav" aria-label="グローバルメニュー">
{nl.join(gnav)}
    </nav>
    <!-- ===== ENTRY CTA v2 START：準備中のボタンから、求人を選べるエントリー一覧への導線に変更 ===== -->
    <a class="btn btn--red hdr__cta" href="{p}entry/index.html" data-cta="header">ENTRY</a>
    <!-- ===== ENTRY CTA v2 END ===== -->
    <button class="hdr__toggle" id="navToggle" aria-expanded="false" aria-controls="drawer" aria-label="メニューを開く"><span></span><span></span><span></span>MENU</button>
  </div>
</header>
<div class="drawer" id="drawer">
{nl.join(drawer)}
  <!-- ===== ENTRY CTA v2 START ===== -->
  <a class="btn btn--red" href="{p}entry/index.html" data-cta="drawer">エントリーする</a>
  <a class="btn btn--ghost" href="{p}contact.html" data-cta="drawer-contact">採用に関するお問い合わせ</a>
  <!-- ===== ENTRY CTA v2 END ===== -->
</div>
'''


def footer(depth):
    p = '../' * depth
    a = '../' * (depth + 1)
    return f'''<footer class="ftr">
  <div class="wrap">
    <div class="ftr__top">
      <div class="ftr__about">
        <a class="logo" href="{p}home.html">{LOGO_IMG.format(a=a)}</a>
        <p>株式会社PAL｜DXソリューションカンパニー。「物流をコストから、戦略資産に。」を掲げ、分断された物流現場・システム・設備・データをつなぎ、物流DXの設計・実装・運用・改善までを担います。</p>
        <dl class="ftr__info"><dt>会社名</dt><dd>株式会社PAL</dd><dt>設立</dt><dd>2000年12月</dd><dt>代表</dt><dd>辻 有吾</dd><dt>資本金</dt><dd>9,000万円</dd><dt>従業員</dt><dd>120名<br>アルバイト・パートを含めると約1,600名</dd><dt>拠点</dt><dd>大阪本社 / 東京オフィス</dd></dl>
      </div>
      <div><h3>RECRUIT</h3><nav aria-label="採用サイト内ナビゲーション"><a href="{p}about.html">PALを知る</a><a href="{p}work.html">仕事を知る</a><a href="{p}career.html">キャリアパス</a><a href="{p}people.html">社員インタビュー・1日の流れ</a><a href="{p}jobs.html">募集要項</a><a href="{p}faq.html">よくある質問</a><a href="{p}entry/index.html">エントリー</a><a href="{p}contact.html">採用に関するお問い合わせ</a></nav></div>
      <div><h3>COMPANY</h3><nav aria-label="コーポレートサイトへのリンク">
        <a href="https://www.pal-style.co.jp/about/mission/" target="_blank" rel="noopener">ミッション・バリュー</a>
        <a href="https://www.pal-style.co.jp/about/message/" target="_blank" rel="noopener">トップメッセージ</a>
        <a href="https://www.pal-style.co.jp/about/role/" target="_blank" rel="noopener">私たちの役割</a>
        <a href="https://www.pal-style.co.jp/service/" target="_blank" rel="noopener">サービス・事業</a>
        <a href="https://www.pal-style.co.jp/case/" target="_blank" rel="noopener">物流DX事例</a>
        <a href="https://www.pal-style.co.jp/company/" target="_blank" rel="noopener">会社概要</a>
        <a href="https://www.pal-style.co.jp/contact-service/" target="_blank" rel="noopener">お問い合わせ（サービスについて）</a>
      </nav></div>
    </div>
    <div class="ftr__bottom"><small>© 2026 PAL Co., Ltd.</small><small>株式会社PAL コーポレートサイト：<a href="https://www.pal-style.co.jp/" target="_blank" rel="noopener">www.pal-style.co.jp</a></small></div>
  </div>
</footer>
<script src="{a}assets/js/app.js" defer></script>
<script src="{p}assets/js/pal-form.js?v=1" defer></script>
<script>
/* 他ページと同じスクロール出現処理（.reveal）。動きを減らす設定では即表示する。 */
(function(){{
  "use strict";
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  var targets = document.querySelectorAll('.reveal');
  if(reduce){{ targets.forEach(function(el){{ el.classList.add('is-in'); }}); return; }}
  if('IntersectionObserver' in window && targets.length){{
    var io = new IntersectionObserver(function(entries){{
      entries.forEach(function(en){{ if(en.isIntersecting){{ en.target.classList.add('is-in'); io.unobserve(en.target); }} }});
    }},{{threshold:.12, rootMargin:'0px 0px -6% 0px'}});
    targets.forEach(function(t){{ io.observe(t); }});
  }} else {{ targets.forEach(function(t){{ t.classList.add('is-in'); }}); }}
}})();
</script>
</body>
</html>
'''


# ---------- 部品 -------------------------------------------------------------

PREVIEW_NOTE = '''      <div class="pnote pnote--warn" id="pfPreview" hidden>
        <b>このプレビュー環境からは送信できません</b>
        デザイン確認用の非公開プレビューのため、受付システムへは接続していません。
        入力内容の確認までお試しいただけますが、送信は行われません。
      </div>
      <div class="pnote pnote--warn pnote--err" id="pfError" role="alert" aria-live="assertive">
        <b>入力内容をご確認ください</b>
        <ul id="pfErrorList"></ul>
      </div>
'''

STEPS = '''      <ol class="psteps" aria-label="入力の進み方">
        <li class="is-current" aria-current="step">入力</li>
        <li>確認</li>
        <li>完了</li>
      </ol>
'''

CONSENT_ROW = '''        <div class="pform__row">
          <span class="pform__lab" id="lab-consent">個人情報の取り扱い<span class="pform__req">必須</span></span>
          <p class="pform__help">ご入力いただいた個人情報は、採用選考およびご連絡の目的にのみ利用します。ご本人の同意なく第三者へ提供することはありません。</p>
          <label class="pform__consent"><input type="checkbox" name="consent" value="true" aria-describedby="err-consent"><span>個人情報の取り扱いに同意します。</span></label>
          <p class="pform__err" id="err-consent"></p>
        </div>
'''

HONEYPOT = ('        <p class="pform__hp" aria-hidden="true"><label>company_url'
            '<input type="text" name="company_url" tabindex="-1" autocomplete="off"></label></p>\n')


def field(name, label, required, itype='text', help_='', autocomplete='', placeholder='',
          options=None, textarea=False):
    req = ('<span class="pform__req">必須</span>' if required else '<span class="pform__opt">任意</span>')
    h = f'          <p class="pform__help">{help_}</p>\n' if help_ else ''
    ac = f' autocomplete="{autocomplete}"' if autocomplete else ''
    ph = f' placeholder="{E(placeholder)}"' if placeholder else ''
    ar = f' aria-describedby="err-{name}"'
    if options is not None:
        opts = '\n'.join(f'            <option value="{E(v)}">{E(t)}</option>' for v, t in options)
        ctl = f'          <select id="f-{name}" name="{name}"{ar}>\n{opts}\n          </select>'
    elif textarea:
        ctl = f'          <textarea id="f-{name}" name="{name}"{ph}{ar} rows="6"></textarea>'
    else:
        ctl = f'          <input type="{itype}" id="f-{name}" name="{name}"{ac}{ph}{ar}>'
    return (f'        <div class="pform__row">\n'
            f'          <label class="pform__lab" for="f-{name}">{label}{req}</label>\n'
            f'{h}{ctl}\n'
            f'          <p class="pform__err" id="err-{name}"></p>\n'
            f'        </div>\n')


HEARD_FROM = ['', 'PAL公式サイト', 'PAL採用サイト', 'Google検索', 'Indeed', 'リクナビ',
              'その他の求人サイト', 'SNS', '社員・知人からの紹介', '人材紹介会社', 'その他']

CATEGORIES = [('', '選択してください'), ('job', '募集職種について'), ('work', '仕事内容について'),
              ('require', '応募資格・必要な経験について'), ('flow', '選考フローについて'),
              ('place', '勤務地・働き方について'), ('new_grad', '新卒採用について'),
              ('career', '中途採用について'), ('visit', '職場見学・会社説明について'),
              ('after', '応募後の確認について'), ('other', 'その他')]


def confirm_rows(rows):
    out = ['      <dl class="pconfirm">']
    for key, label in rows:
        out.append(f'        <div><dt>{label}</dt><dd data-confirm="{key}"></dd></div>')
    out.append('      </dl>')
    return '\n'.join(out) + '\n'


# ---------- 1. 求人別エントリーページ ---------------------------------------

def entry_page(job):
    slug, code = job['slug'], job['job_code']
    title = job['title']
    loc = job['work_location']
    detail = job.get('detail_path') or ''
    detail_link = (f'      <p class="pjob__more"><a href="../{detail}">この求人の募集要項を見る →</a></p>\n'
                   if detail else '')
    fields = (
        field('name', 'お名前', True, autocomplete='name', placeholder='例）山田 太郎') +
        field('name_kana', 'フリガナ', True, autocomplete='off', placeholder='例）ヤマダ タロウ',
              help_='ひらがな・カタカナのどちらでも入力できます。') +
        field('email', 'メールアドレス', True, itype='email', autocomplete='email',
              placeholder='例）taro.yamada@example.com',
              help_='選考のご連絡に使用します。受信できるアドレスをご入力ください。') +
        field('phone', '電話番号', True, itype='tel', autocomplete='tel', placeholder='例）06-1234-5678') +
        field('heard_from', 'PALを知ったきっかけ', False,
              options=[(v, v if v else '選択してください') for v in HEARD_FROM]) +
        field('note', 'その他連絡事項', False, textarea=True,
              help_='ご希望の連絡時間帯や、ご質問などがあればご記入ください。',
              placeholder='例）平日18時以降にご連絡いただけると助かります。') +
        CONSENT_ROW + HONEYPOT
    )
    conf = confirm_rows([('name', 'お名前'), ('name_kana', 'フリガナ'), ('email', 'メールアドレス'),
                         ('phone', '電話番号'), ('heard_from', 'PALを知ったきっかけ'),
                         ('note', 'その他連絡事項'), ('consent', '個人情報の取り扱い')])

    desc = (f'株式会社PAL「{title}」（{loc}・{job["employment_label"]}）へのエントリーフォーム。'
            f'お名前・フリガナ・メールアドレス・電話番号のご入力のみで応募できます。'
            f'履歴書・職務経歴書の事前提出は不要です。（redesign試作・非公開）')
    body = f'''
<main id="main">
<nav class="crumb" aria-label="パンくず"><div class="wrap"><a href="../home.html">採用情報</a><a href="index.html">エントリー</a><span aria-current="page">{E(title)}</span></div></nav>

<section class="phead reveal">
  <div class="wrap">
    <p class="slabel">ENTRY</p>
    <h1 class="ptitle">この求人に<br>エントリーする。</h1>
    <p class="plead">入力は2分ほどで終わります。履歴書・職務経歴書の事前提出は不要です。選考が進んだ段階で、あらためてご案内します。</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap wrap--narrow pentry">
{STEPS}
    <div class="pjob">
      <p class="pjob__code">求人ID {E(code)}</p>
      <p class="pjob__t">{E(title)}</p>
      <dl class="pjob__dl">
        <dt>職種</dt><dd>{E(job['occupation'])}</dd>
        <dt>勤務地</dt><dd>{E(loc)}</dd>
        <dt>雇用形態</dt><dd>{E(job['employment_label'])}</dd>
        {'<dt>給与</dt><dd>' + E(job['salary_text']) + '</dd>' if job.get('salary_text') else ''}
      </dl>
{detail_link}    </div>

{PREVIEW_NOTE}
    <!-- ===== ENTRY FORM v1 START：応募フォーム（職種別）
         受け付ける項目は、氏名・フリガナ・メール・電話・同意（必須）と
         きっかけ・連絡事項（任意）のみ。ファイル添付の仕組みは持たない。 ===== -->
    <div class="pstep is-active" id="pfStep1">
      <h2 class="shead" tabindex="-1">応募内容を入力する</h2>
      <form class="pform" id="pform" data-kind="entry" data-job-slug="{E(slug)}" data-job-code="{E(code)}" data-complete="complete.html" novalidate>
{fields}      </form>
      <div class="pacts">
        <button class="btn btn--red btn--lg" type="button" id="pfNext">入力内容を確認する</button>
      </div>
    </div>

    <div class="pstep" id="pfStep2">
      <h2 class="shead" tabindex="-1">入力内容の確認</h2>
      <p class="pform__help">この内容で送信します。修正する場合は「入力に戻る」を押してください。</p>
{conf}      <div class="pacts">
        <button class="btn btn--red btn--lg" type="button" id="pfSend">この内容で応募する</button>
        <button class="btn btn--ghost btn--lg" type="button" id="pfBack">入力に戻る</button>
      </div>
    </div>
    <!-- ===== ENTRY FORM v1 END ===== -->

    <p class="entry__sec" style="margin-top:32px"><a href="index.html">ほかの募集中の求人を見る</a>　/　<a href="../contact.html">応募前に質問する（採用に関するお問い合わせ）</a></p>
  </div>
</section>
</main>
'''
    return (head(1, f'【試作・非公開】{title}へのエントリー｜{loc}｜株式会社PAL 採用',
                 desc, f'../../entry/{slug}/') +
            header(1, f'【試作・非公開】エントリーフォーム｜<b>デザイン検証用プレビュー｜本番サイト未反映</b>') +
            body + footer(1))


# ---------- 2. エントリー一覧 -----------------------------------------------

def entry_index(jobs):
    cats, prefs, emps = [], [], []
    for j in jobs:
        for lst, key in ((cats, 'category_label'), (prefs, 'pref'), (emps, 'employment_label')):
            if j[key] and j[key] not in lst:
                lst.append(j[key])
    cats.sort(); prefs.sort(); emps.sort()

    def sel(id_, label, values):
        opts = '\n'.join(f'          <option value="{E(v)}">{E(v)}</option>' for v in values)
        return (f'      <label for="{id_}">{label}\n'
                f'        <select id="{id_}">\n'
                f'          <option value="">すべて</option>\n{opts}\n        </select>\n      </label>')

    cards = []
    for j in jobs:
        detail = (f'<a class="pecard__sec" href="../{j["detail_path"]}">募集要項を見る →</a>'
                  if j.get('detail_path') else '')
        cards.append(f'''      <li class="pecard" data-cat="{E(j['category_label'])}" data-pref="{E(j['pref'])}" data-emp="{E(j['employment_label'])}">
        <p class="pecard__cat">{E(j['category_label'])}｜求人ID {E(j['job_code'])}</p>
        <h3 class="pecard__t">{E(j['title'])}</h3>
        <dl class="pecard__dl">
          <dt>勤務地</dt><dd>{E(j['work_location'])}</dd>
          <dt>雇用形態</dt><dd>{E(j['employment_label'])}</dd>
          {'<dt>給与</dt><dd>' + E(j['salary_text']) + '</dd>' if j.get('salary_text') else ''}
        </dl>
        <div class="pecard__acts">
          <a class="btn btn--red" href="{E(j['slug'])}.html" data-cta="entry-list">この求人にエントリーする</a>
          {detail}
        </div>
      </li>''')

    nl = '\n'
    body = f'''
<main id="main">
<nav class="crumb" aria-label="パンくず"><div class="wrap"><a href="../home.html">採用情報</a><span aria-current="page">エントリー</span></div></nav>

<section class="phead reveal">
  <div class="wrap">
    <p class="slabel">ENTRY</p>
    <h1 class="ptitle">応募する求人を<br>選んでください。</h1>
    <p class="plead">募集中の{len(jobs)}件から、応募したい求人をお選びください。求人ごとの専用フォームへ進みます。入力は氏名・フリガナ・メールアドレス・電話番号のみで、履歴書・職務経歴書の事前提出は不要です。</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap">
    <!-- ===== ENTRY LIST v1 START：求人データ（entry/jobs.json）から自動生成 ===== -->
    <div class="pfilter">
{sel('fCat', '職種', cats)}
{sel('fPref', '勤務地', prefs)}
{sel('fEmp', '雇用形態', emps)}
    </div>
    <p class="pcount" id="peCount" role="status">{len(jobs)}件の求人</p>
    <ul class="pelist" id="peList">
{nl.join(cards)}
    </ul>
    <p class="pnote" id="peEmpty" hidden>条件に合う求人がありませんでした。条件を変えてお試しください。</p>
    <!-- ===== ENTRY LIST v1 END ===== -->

    <div class="pnote" style="margin-top:34px">
      <b>応募したい求人が決まっていない場合</b>
      仕事内容や応募資格について、先にご質問いただくこともできます。
      <p style="margin:10px 0 0"><a class="btn btn--ghost" href="../contact.html" data-cta="entry-list-contact">採用に関するお問い合わせ</a></p>
    </div>
  </div>
</section>
</main>
<script>
/* ===== ENTRY LIST FILTER v1：職種・勤務地・雇用形態での絞り込み ===== */
(function(){{
  var list=document.getElementById('peList'); if(!list) return;
  var items=Array.prototype.slice.call(list.children);
  var cnt=document.getElementById('peCount'), empty=document.getElementById('peEmpty');
  var sels=[['fCat','cat'],['fPref','pref'],['fEmp','emp']].map(function(p){{
    return {{el:document.getElementById(p[0]), key:p[1]}};
  }});
  function apply(){{
    var n=0;
    items.forEach(function(li){{
      var ok=sels.every(function(s){{ return !s.el.value || li.getAttribute('data-'+s.key)===s.el.value; }});
      li.hidden=!ok; if(ok) n++;
    }});
    cnt.textContent=n+'件の求人';
    empty.hidden=n>0;
  }}
  sels.forEach(function(s){{ s.el.addEventListener('change',apply); }});
  apply();
}})();
</script>
'''
    desc = ('株式会社PALの採用エントリーページ。募集中の求人から応募したい職種を選び、求人ごとの'
            '専用フォームからご応募いただけます。履歴書・職務経歴書の事前提出は不要です。（redesign試作・非公開）')
    return (head(1, '【試作・非公開】エントリー｜応募する求人を選ぶ｜株式会社PAL 採用', desc, '../../entry/') +
            header(1, '【試作・非公開】エントリー｜<b>デザイン検証用プレビュー｜本番サイト未反映</b>') +
            body + footer(1))


# ---------- 3. 完了ページ ---------------------------------------------------

def complete_page(kind):
    is_entry = (kind == 'entry')
    depth = 1 if is_entry else 0
    p = '../' * depth
    label = '応募' if is_entry else 'お問い合わせ'
    title = (f'【試作・非公開】{label}を受け付けました｜株式会社PAL 採用')
    desc = f'株式会社PALの採用{label}の受付完了ページ。（redesign試作・非公開）'
    lead = ('ご応募いただきありがとうございます。内容を確認のうえ、採用担当者よりご連絡いたします。'
            if is_entry else
            'お問い合わせいただきありがとうございます。内容を確認のうえ、担当者よりご連絡いたします。')
    extra = ('<p>選考の過程で、履歴書・職務経歴書のご提出をお願いする場合があります。'
             'その際は担当者からあらためてご案内します。</p>' if is_entry else
             '<p>内容によっては、回答までにお時間をいただく場合があります。</p>')
    back = (f'<a class="btn btn--ghost" href="index.html">ほかの求人を見る</a>' if is_entry
            else f'<a class="btn btn--ghost" href="{p}jobs.html">募集職種を見る</a>')
    crumb_mid = (f'<a href="index.html">エントリー</a>' if is_entry else '')
    body = f'''
<main id="main">
<nav class="crumb" aria-label="パンくず"><div class="wrap"><a href="{p}home.html">採用情報</a>{crumb_mid}<span aria-current="page">受付完了</span></div></nav>

<section class="phead reveal">
  <div class="wrap">
    <p class="slabel">THANK YOU</p>
    <h1 class="ptitle">{label}を<br>受け付けました。</h1>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap wrap--narrow">
    <ol class="psteps" aria-label="入力の進み方">
      <li class="is-done">入力</li>
      <li class="is-done">確認</li>
      <li class="is-current" aria-current="step">完了</li>
    </ol>
    <div class="pdone" id="pfDone">
      <p class="pdone__code" hidden>受付番号<b id="pfDoneCode"></b></p>
      <p class="pdone__code" hidden>{'応募職種' if is_entry else 'お問い合わせ種別'}<b id="pfDoneJob"></b></p>
      <p style="font-size:16px;line-height:1.9">{lead}</p>
      {extra}
      <p style="font-size:13.5px;color:#5b636c;line-height:1.9">受付番号は、お問い合わせの際にお伝えください。
      お急ぎの場合や内容の変更は、<a href="{p}contact.html">採用に関するお問い合わせ</a>よりご連絡ください。</p>
      <!-- ===== 試作環境の注記：実際には送っていないメールを「送った」と書かないための断り書き ===== -->
      <p style="font-size:12px;color:#8a9099;line-height:1.8">※ この試作環境では、受付確認メールの自動送信は行っていません（メール送信基盤は社内承認後に接続します）。</p>
      <div class="pacts" style="justify-content:center">
        <a class="btn btn--red" href="{p}home.html">採用トップへ戻る</a>
        {back}
      </div>
    </div>
  </div>
</section>
</main>
'''
    canon = '../../entry/complete/' if is_entry else '../contact-complete/'
    return (head(depth, title, desc, canon) +
            header(depth, f'【試作・非公開】受付完了｜<b>デザイン検証用プレビュー｜本番サイト未反映</b>') +
            body + footer(depth))


# ---------- 4. お問い合わせ -------------------------------------------------

def contact_page(jobs):
    job_opts = [('', '選択しない')] + [(j['slug'], f'{j["title"]}（{j["pref"]}）') for j in jobs]
    fields = (
        field('category', 'お問い合わせ種別', True, options=CATEGORIES) +
        field('name', 'お名前', True, autocomplete='name', placeholder='例）山田 太郎') +
        field('name_kana', 'フリガナ', True, autocomplete='off', placeholder='例）ヤマダ タロウ',
              help_='ひらがな・カタカナのどちらでも入力できます。') +
        field('email', 'メールアドレス', True, itype='email', autocomplete='email',
              placeholder='例）taro.yamada@example.com') +
        field('phone', '電話番号', False, itype='tel', autocomplete='tel', placeholder='例）06-1234-5678') +
        field('job_slug', '興味のある求人', False, options=job_opts,
              help_='特定の求人についてのご質問であれば、お選びください。') +
        field('body', 'お問い合わせ内容', True, textarea=True,
              placeholder='ご質問の内容をご記入ください。') +
        CONSENT_ROW + HONEYPOT
    )
    conf = confirm_rows([('category', 'お問い合わせ種別'), ('name', 'お名前'), ('name_kana', 'フリガナ'),
                         ('email', 'メールアドレス'), ('phone', '電話番号'),
                         ('job_slug', '興味のある求人'), ('body', 'お問い合わせ内容'),
                         ('consent', '個人情報の取り扱い')])
    desc = ('株式会社PALの採用に関するお問い合わせフォーム。募集職種・仕事内容・応募資格・選考フロー・'
            '勤務地や働き方についてのご質問を受け付けています。（redesign試作・非公開）')
    body = f'''
<main id="main">
<nav class="crumb" aria-label="パンくず"><div class="wrap"><a href="home.html">採用情報</a><span aria-current="page">採用に関するお問い合わせ</span></div></nav>

<section class="phead reveal">
  <div class="wrap">
    <p class="slabel">CONTACT</p>
    <h1 class="ptitle">採用について<br>質問する。</h1>
    <p class="plead">仕事内容・応募資格・選考の流れ・勤務地や働き方について、応募の前にご質問いただけます。応募をご希望の場合は、<a href="entry/index.html">エントリー</a>からお進みください。</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap wrap--narrow pentry">
{STEPS}
    <div class="pnote">
      <b>よくあるご質問は FAQ に掲載しています</b>
      応募・選考・働き方、職種別のご質問は <a href="faq.html">よくあるご質問</a> もあわせてご確認ください。
    </div>
{PREVIEW_NOTE}
    <!-- ===== CONTACT FORM v1 START：採用に関するお問い合わせ。
         応募フォームとは分けて受け付ける（問い合わせだけでは応募者として登録しない）。
         ファイル添付の仕組みは持たない。 ===== -->
    <div class="pstep is-active" id="pfStep1">
      <h2 class="shead" tabindex="-1">お問い合わせ内容を入力する</h2>
      <form class="pform" id="pform" data-kind="contact" data-complete="contact-complete.html" novalidate>
{fields}      </form>
      <div class="pacts">
        <button class="btn btn--red btn--lg" type="button" id="pfNext">入力内容を確認する</button>
      </div>
    </div>

    <div class="pstep" id="pfStep2">
      <h2 class="shead" tabindex="-1">入力内容の確認</h2>
      <p class="pform__help">この内容で送信します。修正する場合は「入力に戻る」を押してください。</p>
{conf}      <div class="pacts">
        <button class="btn btn--red btn--lg" type="button" id="pfSend">この内容で送信する</button>
        <button class="btn btn--ghost btn--lg" type="button" id="pfBack">入力に戻る</button>
      </div>
    </div>
    <!-- ===== CONTACT FORM v1 END ===== -->
  </div>
</section>
</main>
'''
    return (head(0, '【試作・非公開】採用に関するお問い合わせ｜株式会社PAL 採用', desc, '../contact/') +
            header(0, '【試作・非公開】採用に関するお問い合わせ｜<b>デザイン検証用プレビュー｜本番サイト未反映</b>') +
            body + footer(0))


# ---------- 書き出し ---------------------------------------------------------

def write(rel, content, results):
    path = os.path.join(SITE, rel)
    old = None
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            old = f.read()
    if CHECK:
        results.append((rel, 'OK' if old == content else ('DIFF' if old is not None else 'MISSING')))
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    results.append((rel, 'same' if old == content else ('updated' if old is not None else 'created')))


def main():
    with open(DATA, encoding='utf-8') as f:
        data = json.load(f)
    jobs = data['jobs']
    results = []
    write('entry/index.html', entry_index(jobs), results)
    for j in jobs:
        write(f'entry/{j["slug"]}.html', entry_page(j), results)
    write('entry/complete.html', complete_page('entry'), results)
    write('contact.html', contact_page(jobs), results)
    write('contact-complete.html', complete_page('contact'), results)

    ng = [r for r in results if r[1] in ('DIFF', 'MISSING')]
    if JSON_OUT:
        print(json.dumps({
            'ok': not (CHECK and ng),
            'root': SITE,
            'data': DATA,
            'jobs': len(jobs),
            'files': [{'path': rel, 'state': st} for rel, st in results],
            'changed': [rel for rel, st in results if st in ('created', 'updated')],
            'ng': [rel for rel, st in ng],
        }, ensure_ascii=False))
        if CHECK and ng:
            sys.exit(1)
        return
    for rel, st in results:
        print(f'  {st:8} {rel}')
    print(f'{len(results)} files / jobs={len(jobs)}')
    if CHECK and ng:
        print(f'NG: {len(ng)} 件が生成物と一致しません。python3 -I tools/build_entry.py を実行してください。')
        sys.exit(1)
    if CHECK:
        print('OK: 生成物と一致しています。')


if __name__ == '__main__':
    main()
