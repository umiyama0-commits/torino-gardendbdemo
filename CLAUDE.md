@AGENTS.md

# Tollino Garden Main DB

店舗行動観測ナレッジベース。小売・サービス業の現場観測を構造化し、業種横断の信頼付きナレッジに昇華するシステム。

## 基本アーキテクチャ（コンパイラ・アナロジー）

ナレッジの流れを「ソースコードのコンパイル」に見立てた5段パイプライン:

```
raw/  →  コンパイル(wiki)  →  LLM自動構造化  →  Linting  →  Q&A
```

### 1. raw/ — 生データ取り込み
- カメラ映像・報告書PDF・日報テキスト
- 現場から上がってくる未加工の一次情報

### 2. コンパイル (wiki) — ナレッジDB構築
- Observation（観測事実）→ Insight（知見）→ CrossIndustryPattern（業種横断パターン）
- 3層Provenance: ①固有知(FIELD_OBSERVED) → ②汎用知(ANONYMIZED_DERIVED) → ③公知(PUBLIC_CODIFIED)
- 4層モデル: MOVEMENT / APPROACH / BREAKDOWN / TRANSFER
- 3価値軸: REVENUE_UP / COST_DOWN / RETENTION

### 3. LLM自動構造化 — オントロジー自動タグ付け
- Gemma 4等のLLMで投入テキストからモデル層・価値軸・オントロジータグを自動推定
- 98種のOntologyTag体系への自動マッピング

### 4. Linting — 信頼度検証・スコア加算
- ③公知形式知とのクラスタリング・照合
- 同一テーマが複数Provenanceで裏付けられると信頼度スコアが加算（信頼チェーン）
- 類似Observationの自動グルーピング

### 5. Q&A — AI質問応答（将来）
- 蓄積されたナレッジに対する自然言語での質問応答画面（画面L）
- Observation・Insight・Patternを横断して根拠付きで回答

## PF分析フレームワーク（AnalysisTree）

コンサル現場で使う標準分析ツリー。テンプレートをPJ毎にクローンして使用。

```
CATEGORY → PERFORMANCE → INDICATOR → FACTOR → COUNTERMEASURE
大分類       パフォーマンス     指標          要因        対策
```

- templateNodeId による横串集計（同一指標を全PJ横断で比較）
- INDICATOR にビフォー/アフター計測データ（AnalysisMetric）

## 設計思想 — Karpathy「Software 2.0」との接続

本システムの設計はAndrej Karpathyの「Software 2.0」思想を参考にしている。

- **Software 1.0**: 人間がルールを書いてデータを処理する
- **Software 2.0**: ニューラルネットが処理の中心。人間はデータとアーキテクチャを設計する

Tollino Gardenのコンパイラ・パイプラインはこの思想を具現化したもの:

1. **raw/ (入力)** — 現場の生データ（映像・報告書・日報）がソースコード
2. **LLM自動構造化 (コンパイル)** — GPT-4oが「コンパイラ」として非構造データを構造化知識に変換。ルールベースではなくニューラルネットが変換ロジックを担う
3. **Linting (検証)** — 信頼度チェーンが「型チェッカー」。複数Provenanceでの裏付けが型安全性に相当
4. **Q&A (実行)** — 蓄積されたナレッジへの問い合わせが「プログラムの実行」

従来のコンサルナレッジ管理は「人間がタグ付け・分類する」Software 1.0的アプローチだった。本システムはLLMにその判断を委ね、人間はオントロジー設計（98タグ体系）とProvenance構造の設計に集中する。これがSoftware 2.0的な逆転。

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma + PostgreSQL (Vercel本番) / SQLite (ローカル開発)
- Vercel Blob Storage (ファイルアップロード)
- Tailwind CSS 4 + shadcn/ui
- force-dynamic + Suspense streaming で高速化済み
- LLM: 現在 GPT-4o（OpenAI）。本番環境構築時にモデル選定を再検討する
  - Anthropic Claude Sonnet への切替は ANTHROPIC_API_KEY 設定のみで可能
