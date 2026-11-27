#!/usr/bin/env python3
# ============================================================
# ===== CTA PATCH v2 =====
# 「準備中」で止まっていた ENTRY / 応募 CTA を、
#   ・ヘッダー ENTRY        → entry/index.html（求人を選ぶ一覧）
#   ・ドロワー エントリーする → entry/index.html（＋お問い合わせ）
#   ・求人詳細「応募する」   → entry/<slug>.html（その求人専用）
#   ・jobs.html のカード     → entry/<slug>.html
#   ・フッター「準備中」     → エントリー／採用に関するお問い合わせ
# に差し替え、採用に関するお問い合わせ CTA を追加する。
# 何度実行しても同じ結果になる（既に差し替え済みならスキップ）。
#
# home.html は生成物のため、正本 newtop-c-v2.html を直してから
# tools/build_home.py を実行すること（このスクリプトは home.html を触らない）。
# ============================================================
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site', 'redesign')

# 公開導線に乗っている正本ページ（home.html は newtop-c-v2.html から生成）
PAGES = (['newtop-c-v2.html', 'about.html', 'work.html', 'people.html', 'career.html',
          'jobs.html', 'faq.html'] +
         [f'people/{n}.html' for n in ('bpo', 'cleaning', 'corporate', 'dts', 'fde', 'sales', 'system')] +
         [f'jobs/{n}.html' for n in ('dts', 'fde', 'large-driver', 'logistics-operation')] +
         [f'jobs/openings/{n}.html' for n in
          ('atsugi-member', 'engagement-member', 'fde-associate', 'fde-leader', 'funabashi-associate',
           'higashihiroshima-member', 'hr', 'staffing-sales-leader', 'suma-manager', 'system-engineer')])

# 求人詳細ページ → 専用エントリーページのスラッグ
DETAIL_SLUG = {f'jobs/openings/{n}.html': n for n in
               ('atsugi-member', 'engagement-member', 'fde-associate', 'fde-leader',
                'funabashi-associate', 'higashihiroshima-member', 'hr',
                'staffing-sales-leader', 'suma-manager', 'system-engineer')}
DETAIL_SLUG['jobs/dts.html'] = 'dts-route-driver'
DETAIL_SLUG['jobs/large-driver.html'] = 'large-driver'

S = '<!-- ===== ENTRY CTA v2 START：準備中のボタンを、求人ごとのエントリーページへの導線に差し替え ===== -->'
Eend = '<!-- ===== ENTRY CTA v2 END ===== -->'


def prefix(rel):
    return '../' * rel.count('/')


def patch(rel):
    path = os.path.join(SITE, rel)
    with open(path, encoding='utf-8') as f:
        src = f.read()
    orig = src
    P = prefix(rel)
    hits = []

    # 1. ヘッダーの ENTRY ボタン
    old = '<button class="btn btn--red hdr__cta btn--off" type="button" disabled>ENTRY</button>'
    if old in src:
        src = src.replace(old, f'{S}\n    <a class="btn btn--red hdr__cta" href="{P}entry/index.html" '
                               f'data-cta="header">ENTRY</a>\n    {Eend}')
        hits.append('header')

    # 2. SPドロワーのエントリーボタン（＋お問い合わせ）
    old = '<button class="btn btn--red btn--off" type="button" disabled>エントリーする</button>'
    if old in src:
        src = src.replace(old, f'{S}\n  <a class="btn btn--red" href="{P}entry/index.html" '
                               f'data-cta="drawer">エントリーする</a>\n'
                               f'  <a class="btn btn--ghost" href="{P}contact.html" '
                               f'data-cta="drawer-contact">採用に関するお問い合わせ</a>\n  {Eend}')
        hits.append('drawer')

    # 3. フッターの「エントリー（準備中）」
    old = '<span class="applyoff">エントリー（準備中）</span>'
    if old in src:
        src = src.replace(old, f'<a href="{P}entry/index.html" data-cta="footer">エントリー</a>'
                               f'<a href="{P}contact.html" data-cta="footer-contact">採用に関するお問い合わせ</a>')
        hits.append('footer')

    # 4. 求人詳細ページの「この求人に応募する」
    slug = DETAIL_SLUG.get(rel)
    old = '<button class="btn btn--red btn--lg btn--off" type="button" disabled>この求人に応募する</button>'
    if slug and old in src:
        src = src.replace(old, f'{S}\n      <a class="btn btn--red btn--lg" href="{P}entry/{slug}.html" '
                               f'data-cta="job-detail" data-job-slug="{slug}">この求人に応募する</a>\n      {Eend}')
        # 応募ボタンの近くに、採用に関するお問い合わせ導線を足す
        anchor = '<p class="entry__sec">'
        if anchor in src and 'data-cta="job-detail-contact"' not in src:
            src = src.replace(anchor,
                              f'<p class="entry__sec" style="margin-bottom:6px">'
                              f'<a href="{P}contact.html" data-cta="job-detail-contact">'
                              f'応募の前に質問する（採用に関するお問い合わせ）</a></p>\n    {anchor}', 1)
        hits.append(f'detail→{slug}')

    # 5. jobs.html のカード（求人ごとに行き先が違う）
    if rel == 'jobs.html':
        cards = re.split(r'(?=<li class="jcard")', src)
        for i, c in enumerate(cards):
            m = re.search(r'class="jcard__cta" href="jobs/(?:openings/)?([a-z0-9-]+)\.html"', c)
            if not m:
                continue
            page = m.group(1)
            sl = DETAIL_SLUG.get(f'jobs/openings/{page}.html') or DETAIL_SLUG.get(f'jobs/{page}.html')
            if not sl:
                continue
            cards[i] = c.replace(
                '<button class="jcard__apply" type="button" disabled>この求人に応募する</button>',
                f'<a class="jcard__apply" href="entry/{sl}.html" data-cta="jobs-card" '
                f'data-job-slug="{sl}">この求人に応募する</a>')
        src = ''.join(cards)
        # ページ下部の「応募する（準備中）」→ エントリー一覧／お問い合わせ
        old = '<button class="btn btn--red btn--lg btn--off" type="button" disabled>応募する</button>'
        if old in src:
            src = src.replace(old, f'{S}\n      <a class="btn btn--red btn--lg" href="entry/index.html" '
                                   f'data-cta="jobs-bottom">エントリーする'
                                   f'<span class="btn__ico" aria-hidden="true">▶</span></a>\n      {Eend}')
        src = src.replace(
            '<p class="applynote">※ 応募先URLの設定前です。採用担当の承認後、各求人ページから直接応募できるようになります。</p>',
            '<p class="entry__sec"><a href="contact.html" data-cta="jobs-bottom-contact">'
            '応募の前に質問する（採用に関するお問い合わせ）</a></p>')
        hits.append('jobs-cards')

    # 6. HOME（正本）の JOIN PAL
    if rel == 'newtop-c-v2.html':
        old = '<button class="btn btn--red btn--lg btn--off" type="button" disabled>応募する</button>'
        if old in src:
            src = src.replace(old, f'{S}\n      <a class="btn btn--red btn--lg" href="entry/index.html" '
                                   f'data-cta="home-joinpal">エントリーする'
                                   f'<span class="btn__ico" aria-hidden="true">▶</span></a>\n      {Eend}')
        src = src.replace(
            '<p class="applynote">※ 現在、各求人の応募先URLは準備中です。採用担当の承認後、ボタンから直接応募できるようになります。</p>',
            '<p class="entry__sec"><a href="contact.html" data-cta="home-contact">'
            '採用に関するお問い合わせ</a></p>')
        hits.append('home-joinpal')

    # 7. FAQ 下部の「応募する（準備中）」
    if rel == 'faq.html':
        src = src.replace(
            '<p class="entry__sec"><span class="applyoff">応募する（準備中）</span></p>',
            '<p class="entry__sec"><a href="entry/index.html" data-cta="faq-bottom">エントリーする</a>'
            '　/　<a href="contact.html" data-cta="faq-bottom-contact">'
            '採用に関するお問い合わせ</a></p>')
        hits.append('faq-bottom')

    if src == orig:
        return rel, 'same', hits
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    return rel, 'updated', hits


def main():
    n = 0
    for rel in PAGES:
        r, st, hits = patch(rel)
        if st == 'updated':
            n += 1
        print(f'  {st:8} {r}  {",".join(hits) if hits else "-"}')
    print(f'{len(PAGES)} pages / updated={n}')


if __name__ == '__main__':
    main()
