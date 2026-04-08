@AGENTS.md

# Tollino Garden Main DB

店舗行動観測ナレッジベース。小売・サービス業の現場観測を構造化し、業種横断の信頼付きナレッジに昇華するシステム。

## 基本アーキテクチャ（コンパイラ・アナロジー）

Karpathyの「LLM-Powered Personal Knowledge Base」ワークフローを小売・サービス観測領域に特化させた8段パイプライン:

```
raw/ → LLM Compilation → Wiki(KB) → Q&A → Output
              ↑            ↓
         self-improving loop
              ↓
           Linting → Extra Tools → Future(fine-tuning)
```

### Stage 1. Data Ingest — 生データ取り込み
- カメラ映像・報告書PDF・日報テキスト・Webクリッピング
- 現場から上がってくる未加工の一次情報
- Clipper / ホットキー / ファイルアップロード（PDF/Word/動画）で投入

### Stage 2. LLM Compilation — LLM自動構造化
- LLMが raw/ を読み・要約・構造化（Karpathy原型の中核）
- Gemma 4 / GPT-4o 等のLLMで投入テキストからモデル層・価値軸・オントロジータグを自動推定
- 98種のOntologyTag体系への自動マッピング
- ルールベースではなくニューラルネットが変換ロジックを担う（Software 2.0）

### Stage 3. The Wiki (KB) — ナレッジDB構築
- Observation（観測事実）→ Insight（知見）→ CrossIndustryPattern（業種横断パターン）
- 3層Provenance: ①固有知(FIELD_OBSERVED) → ②汎用知(ANONYMIZED_DERIVED) → ③公知(PUBLIC_CODIFIED)
- 4層モデル: MOVEMENT / APPROACH / BREAKDOWN / TRANSFER
- 3価値軸: REVENUE_UP / COST_DOWN / RETENTION

### Stage 4. Q&A / Querying — AI質問応答
- 蓄積されたナレッジに対する自然言語での質問応答画面（画面L）
- **no RAG**: LLMが自身のindex(Wiki)を直接読む。ベクトル検索に頼らずLLMのコンテキストに知識を載せる
- Observation・Insight・Patternを横断して根拠付きで回答
- **self-improving loop**: Q&Aの結果がStage 2にフィードバックし、新たな構造化・接続を誘発

### Stage 5. Output Formats — 出力形式（将来拡張）
- Markdown / プレゼン(Marp) / 可視化(matplotlib) 等への変換
- Obsidian等のIDEフロントエンドとの連携

### Stage 6. Linting — 信頼度検証・能動的品質向上
- ③公知形式知とのクラスタリング・照合
- 同一テーマが複数Provenanceで裏付けられると信頼度スコアが加算（信頼チェーン）
- 類似Observationの自動グルーピング
- **矛盾検出**: 既存知識との不整合を発見
- **ギャップ補完**: 不足している観点・データを提案
- **接続発見**: 異なるObservation間の隠れた関連を発掘
- **トピック提案**: 次に調査すべきテーマを能動的に提示

### Stage 7. Extra Tools — 検索・UI
- Web UI（Next.js）: 多軸フィルター検索・ダッシュボード
- CLI（将来）: コマンドラインからの知識問い合わせ

### Stage 8. Future Direction — 知識の重み化（将来）
- 蓄積データから合成データ生成
- 業種特化LLMのfine-tuning
- ナレッジをモデルの重みに焼き込み、推論時にDB不要で回答可能にする

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

Tollino Gardenのパイプラインはこの思想を具現化したもの:

1. **raw/ (ソースコード)** — 現場の生データ（映像・報告書・日報）がプログラムのソースコード
2. **LLM Compilation (コンパイラ)** — LLMが「コンパイラ」として非構造データを構造化知識に変換
3. **Wiki/KB (オブジェクトコード)** — コンパイル済みの構造化ナレッジ
4. **Linting (型チェッカー)** — 信頼度チェーンが型安全性。矛盾検出・ギャップ補完・接続発見も含む能動的プロセス
5. **Q&A (プログラム実行)** — ナレッジへの問い合わせが実行。**self-improving loop**で実行結果が再コンパイルを誘発
6. **Future: fine-tuning (ネイティブコンパイル)** — 知識をモデルの重みに焼き込み、DB不要で推論可能にする

従来のコンサルナレッジ管理は「人間がタグ付け・分類する」Software 1.0的アプローチだった。本システムはLLMにその判断を委ね、人間はオントロジー設計（98タグ体系）とProvenance構造の設計に集中する。これがSoftware 2.0的な逆転。

### Karpathy原型との主要な差異
- **ドメイン特化**: 個人知識ベースではなく、小売・サービス業の組織的ナレッジ管理
- **Provenance 3層**: 固有知→汎用知→公知の信頼チェーンは業種横断パターン発見のための独自拡張
- **PF分析フレームワーク**: コンサル現場向けの分析ツリー構造（Karpathy原型にはない）

## 技術スタック

- Next.js 16 (App Router) + React 19 + TypeScript
- Prisma + PostgreSQL (Vercel本番) / SQLite (ローカル開発)
- Vercel Blob Storage (ファイルアップロード)
- Tailwind CSS 4 + shadcn/ui
- force-dynamic + Suspense streaming で高速化済み
- LLM: 現在 GPT-4o（OpenAI）。本番環境構築時にモデル選定を再検討する
  - Anthropic Claude Sonnet への切替は ANTHROPIC_API_KEY 設定のみで可能
