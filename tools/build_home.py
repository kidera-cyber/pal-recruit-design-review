# -*- coding: utf-8 -*-
"""
===== HOME-SYNC v1 =====
site/redesign/home.html を site/redesign/newtop-c-v2.html から生成する。

HOMEのデザインを2つのHTMLで別々に直すと、片方だけ直し忘れる。
実際に「3分割写真の削除」が c-v2 だけに適用され、home.html には
別クラス名（.field-v2__photos）で残っていた。
そこで newtop-c-v2.html を正本とし、home.html は必ずここから生成する。

ビルドツールは入れていない。python3 だけで動く。

  python3 -I tools/build_home.py          … home.html を生成
  python3 -I tools/build_home.py --check  … 生成結果が現在の home.html と一致するか確認（差分があれば終了コード1）

home.html を直接編集しないこと。編集するのは newtop-c-v2.html か、このスクリプト。

正本から差し替える部分（URLごとに違ってよい情報）
  ・<title> と <meta name="description">
    c-v2 は「案C v2」という検証用の名前なので、正式HOME側はその名前を使わない。
  ・検証用UI（画面上部の proto-bar と「比較ページへ戻る」リンク）は入れない。
同じにする部分
  ・canonical（../）、robots（noindex）、JSON-LD、CSS/JSの参照、本文、リンク
  ・2つは同じディレクトリにあるので、相対パスはそのままで正しい。
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'site/redesign/newtop-c-v2.html')
DST = os.path.join(ROOT, 'site/redesign/home.html')

TITLE = '【試作・非公開】HOME｜物流DXを現場から実装する。株式会社PAL 採用サイト'
DESC = ('株式会社PALの採用サイトHOME（非公開・検証用）。物流現場の運営と、'
        'システム・設備・データを組み合わせた仕組みづくりの両方を担うPALの仕事と、'
        '9職種・社員の声・キャリア・募集職種への入口を紹介します。'
        '文言・数値・CTA・JSON-LDは本番index.htmlと完全同一。')

HEADER = ('<!-- ===== HOME-SYNC v1：このファイルは tools/build_home.py が\n'
          '     site/redesign/newtop-c-v2.html から生成しています。直接編集しないでください。\n'
          '     デザイン・構成を変えるときは newtop-c-v2.html を直し、\n'
          '       python3 -I tools/build_home.py\n'
          '     を実行して、このファイルを作り直してください。\n'
          '     正本との違いは、title / description と、検証用UI（上部の帯と\n'
          '     「比較ページへ戻る」リンク）を入れないことだけです。 ===== -->\n')


def build():
    s = io.open(SRC, encoding='utf-8').read()

    # 1) 検証用UI（上部の帯）を丸ごと外す。「比較ページへ戻る」リンクもこの中にある。
    m = re.search(r'[ \t]*<div class="proto-bar">.*?</div>\n', s, re.S)
    if not m:
        sys.exit('NG: proto-bar が見つからない')
    bar = m.group(0)
    s = s[:m.start()] + s[m.end():]

    # 2) title / description を正式HOME用に差し替える
    def one(pat, repl, label):
        nonlocal s
        if len(re.findall(pat, s, re.S)) != 1:
            sys.exit('NG: %s が1つでない' % label)
        s = re.sub(pat, lambda _: repl, s, count=1, flags=re.S)

    one(r'<title>.*?</title>', '<title>%s</title>' % TITLE, 'title')
    one(r'<meta name="description" content=".*?">',
        '<meta name="description" content="%s">' % DESC, 'description')

    # 3) 生成物であることを先頭に明記
    s = s.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + HEADER, 1)

    # 4) 自分自身を指すリンク（ヘッダーロゴ・グローバルナビ「ホーム」・ドロワー・フッターロゴ）を
    #    home.html へ向け直す。URLごとに変わるので機械的にコピーしない。
    n = len(re.findall(r'href="newtop-c-v2\.html"', s))
    if n == 0:
        sys.exit('NG: 自己リンクが見つからない')
    s = s.replace('href="newtop-c-v2.html"', 'href="home.html"')

    # 5) 念のため、検証用ページへのリンクが残っていないか確認
    leftovers = re.findall(r'href="(newtop-compare\.html|newtop-c\.html|newtop-c-v2\.html)[^"]*"', s)
    if leftovers:
        sys.exit('NG: 検証用ページへのリンクが残っている: %s' % leftovers)
    return s, len(bar.encode()), n


def main():
    out, barlen, nself = build()
    if '--check' in sys.argv:
        cur = io.open(DST, encoding='utf-8').read() if os.path.exists(DST) else ''
        if cur == out:
            print('  home.html は正本と同期しています')
            return 0
        print('  home.html が正本と同期していません。python3 -I tools/build_home.py を実行してください')
        return 1
    io.open(DST, 'w', encoding='utf-8').write(out)
    print('  home.html を生成：%d bytes（検証用UI %d bytes を除外／自己リンク %d 箇所を home.html に調整）'
          % (len(out.encode()), barlen, nself))
    return 0


if __name__ == '__main__':
    sys.exit(main())
