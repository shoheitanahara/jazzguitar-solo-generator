## Jazz Guitar Solo Generator（個人練習用MVP）

Autumn Leaves（キーGm想定）冒頭8小節ループのコード進行を見ながら、**TABのソロ例を無限生成して覚える**ためのミニアプリです。

- **生成の方針**: 単なるランダムではなく、  
  **制約（ルール）＋候補生成＋スコアリング（採点）＋多様性フィルタ**で「音楽的に良い」上位のみを表示します。
- **音出し**: Tone.jsでコードを8小節ループ再生（BPM可変 / Start・Stop / ストラム＋軽いリバーブ）

注意: 著作権のある既存メロディや既存録音のフレーズのコピーは行いません（練習用のオリジナル生成のみ）。

## Getting Started

### セットアップ

```bash
npm i
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 使い方

- **Generate**: pool（内部候補K）から上位Nを選んでTABを表示します
- **seed**: 同じseedなら同じ候補群を再現できます
- **style / level / sliders**: 密度・クロマチック率・和音ヒット・モチーフ反復・運指レンジなどを調整します
- **Start/Stop + BPM**: 8小節ループのコードを再生します

## 生成ロジック（概要）

実装は `lib/` 配下に分離しています。

- **曲データ**: `lib/songs/autumnLeavesGm.ts`
- **音楽モデル**: `lib/music/*`（コード解析、コードトーン/ガイドトーン、進行上のコード参照など）
- **候補生成**: `lib/generator.ts`
  - 強拍（1拍目/3拍目）は chord tones を優先
  - 特に 3rd / 7th を優先（ガイドトーン）
  - D7ではF#（3rd）を一定確率で含め、Gmへの解決を促進
  - style/level/パラメータで motif / chord hit / クロマチック装飾の出やすさを調整
- **採点**: `lib/scoring.ts`
  - strong beat のコードトーン/ガイドトーン
  - voice leading（次コードへの近さ）
  - tension→解決
  - 運指/レンジ/跳躍/リズム単調さ など
- **多様性フィルタ**: `lib/diversity.ts`
  - リズムパターンと音高n-gramの類似度で「良いけど同じ」を弾きます
- **TAB化（運指）**: `lib/tab.ts`
  - 各音（/和音）の弦・フレット候補を列挙
  - 移動コスト最小になるようDPで経路選択
  - 6弦TAB（等幅・コピーしやすい）へレンダリング

## “ギターっぽい音” と “ストラム感” の調整ポイント

`lib/audio.ts` の以下を調整すると変化が分かりやすいです。

- **ストラム感**: `DEFAULT_GUITAR_LIKE_SETTINGS.strumMinMs / strumMaxMs`
- **残響**: `DEFAULT_GUITAR_LIKE_SETTINGS.reverbWet / reverbDecay`
- **アタック/減衰**: `DEFAULT_GUITAR_LIKE_SETTINGS.attack / decay / sustain / release`

（UIはMVPのためBPMとStart/Stopのみ露出。音色パラメータはコード側で調整します。）

## 主要ファイル

- `app/page.tsx`: 1ページUI（進行表示 / TAB候補リスト / 解説 / 再生）
- `components/*`: UI部品（Controls, ChordChart, GeneratedList, Explanation, AudioControls）
- `lib/*`: 生成ロジックと再生ロジック
