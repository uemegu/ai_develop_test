# デザインおよび設計メモ

## 目的

偉人の名言をスタイリッシュに表示し、ピン留め・お気に入り管理・カスタム登録ができるシングルページアプリケーション。Figma MCP で共有された "AI_DEV" プロジェクトのモバイル UI を参考に実装している。

## 画面構成

### 1. 今日の格言 (Home)
- ヒーローカードにランダムな名言を表示。
- 背景は 3 枚 (`/backgrounds/image{1..3}.webp`) からランダムに選択し、スクラムで覆って可読性を担保。
- 「ピン留め」ボタン: 今日の名言をお気に入りへ保存。
- 「別の格言」ボタン: 名言リストからフェッチ済みの別の名言を表示。

### 2. お気に入りの格言 (Favorites)
- ピン留めした名言をカード形式でグリッド表示。
- 各カードの背景はピン留め時のランダム背景を保持。
- カード内アクション:
  - 編集: インラインフォームでテキスト/発言者を更新。
  - 削除: ピン留め解除および必要に応じてカスタム名言も削除。

### 3. 名言を登録 (Add)
- テキストエリア + 任意の発言者入力。
- バリデーション: テキスト必須・発言者未入力時は "Anonymous" へフォールバック。
- 登録後は自動でピン留め & お気に入りタブへ遷移。

### フッターナビゲーション
- 3 つのタブボタン (今日 / お気に入り / 登録)。
- アクティブ状態は白、非アクティブは半透明。

## データモデル

```ts
 type Quote = {
   id: string;
   text: string;
  author: string;
   background?: string; // ランダム背景の URL
   isCustom?: boolean;  // ユーザー登録した名言かどうか
   createdAt?: string;  // カスタム登録時の ISO 文字列
 };
```

### データソース
1. `public/quotes.json`
   - 初期名言セット。
   - 开発時に `spec/quote.txt` を JSON 化して配置。
   - 各エントリには ID, テキスト, 作者 (任意で作成) を含む。

2. `localStorage`
   - `AI_DEV_CUSTOM_QUOTES_V1`: ユーザー登録した名言の配列。
   - `AI_DEV_PINNED_QUOTES_V1`: ピン留め済み名言の配列。
   - 保存形式はいずれも `Quote[]` JSON (背景や `isCustom` フラグを含む)。

## 状態管理 (React Hooks)

| state                 | 説明 |
|----------------------|------|
| `view`               | 現在表示中のタブ (`today` / `favorites` / `add`) |
| `allQuotes`          | ベース名言 + カスタム名言をマージしたリスト |
| `customQuotes`       | 登録名言のリスト (ローカルストレージ同期) |
| `pinnedQuotes`       | ピン留め名言のリスト (背景情報付き) |
| `todayQuote`         | 今日の格言として表示中の `Quote` |
| `isLoading` / `error`| フェッチ状態とエラーバナー |
| `editingId` など     | お気に入り編集用のフォーム状態 |
| `text`, `author`     | 登録フォームの入力値 |

## 処理フロー

### 初期ロード
1. `localStorage` からカスタム名言・ピン留め名言を読み込み (`safeParseQuotes`)。
2. カスタム名言は `isCustom = true` に正規化し、必要なら背景を付与。
3. `fetch('/quotes.json')` で初期名言を取得。
4. すべてを ID で重複排除したリストへマージ。
5. ピン留めには背景を付与したまま `pinnedQuotes` へセット。
6. `todayQuote` が未設定の場合、ランダムで選択して背景を適用。

### ピン留め (`handlePinQuote`)
- 既存チェック → 未ピン時は背景付きで `pinnedQuotes` へ追加。
- 追加後 `localStorage` 同期 (`persistPinned`)。

### 登録 (`handleAddQuote`)
- バリデーション → `Quote` 作成 → `customQuotes`, `allQuotes`, `pinnedQuotes` に反映。
- `localStorage` 同期。
- ビューを `favorites` に切り替え。

### お気に入り編集 (`handleUpdatePinned`)
- `pinnedQuotes` 内の対象を更新。
- カスタム名言に存在する場合はそちらも更新。
- `localStorage` 同期。

### お気に入り削除 (`handleDeletePinned`)
- `pinnedQuotes` から削除 → 同期。
- カスタム名言にも存在する場合は削除し、`allQuotes` からも除外。

### 今日の格言シャッフル (`handleShuffleQuote`)
- `allQuotes` が 2 件以上のとき、現在と異なる名言を再抽選。
- 背景を再設定。

## スタイリング

- `src/index.css`: フォント (Space Grotesk)、共通背景、ベースカラー、リセット。
- `src/App.css`: セクションレイアウト、カードスタイル、ボタン、フォーム、レスポンシブ調整。
- デザインは Figma の配色 (ダークトーン + パープルアクセント) をベースに実装。
- お気に入りカードには CSS カスタムプロパティ `--card-bg` を設定し、背景画像を擬似要素で表示。

## アセット

- `public/backgrounds/image{1..3}.webp`: ランダム背景画像。
- `public/quotes.json`: サーバーフェッチ用の初期データ。

## ビルド・動作確認

- `npm run build` で TypeScript チェック + Vite ビルド。Node 20.19+ が推奨だが 20.9 でもビルドが通ることを確認 (警告あり)。
- localStorage を利用するため、ブラウザでの挙動確認時は同一オリジンでアクセス。

