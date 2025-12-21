import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const quotesPath = path.join(__dirname, "..", "docs", "quotes.json");
const publicQuotesPath = path.join(__dirname, "..", "public", "quotes.json");

function loadQuotes() {
  const json = fs.readFileSync(quotesPath, "utf-8");
  const data = JSON.parse(json);

  if (!Array.isArray(data)) {
    throw new Error("quotes.json が配列じゃないっぽい…形式チェックしてみて！");
  }
  return data;
}

/**
 * Gemini 2.5 Pro を 2回呼び出して
 * - 1回目: 格言を5個生成
 * - 2回目: 5個を笑える順に並べて3番目だけ返す
 */
async function generateQuoteWithTwoCalls() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 GEMINI_API_KEY が設定されてないよ");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

  // ──────────────────────────────
  // ① 5個の格言を生成
  // ──────────────────────────────
  const prompt1 = `
以下のような意味がわかるようでわからない格言を5個生成してください
笑えるやつが良いです

「朝焼けを見て、夕焼けを語るな。」
「右手に持つ水は、左手で飲むべからず。」
「石を積む者は、石を積む。」
「靴下が片方ないなら、両方脱げ。」
「夜中のコンビニで牛乳を買う男に嘘はない。」
「傘を貸したら帰りは走れ。」
`.trim();

  const result1 = await model.generateContent(prompt1);
  const text1 = result1.response.text().trim();

  // text1 の例想定：
  // 1. 「〜〜〜」
  // 2. 「〜〜〜」
  // みたいな感じ。フォーマットはあまりガチガチにパースしないで、
  // そのまま次のプロンプトに渡すスタイルにしてる。

  // ──────────────────────────────
  // ② 5個を笑える順に並べて3番目だけ出力してもらう
  // ──────────────────────────────
  const prompt2 = `
以下はあなたが生成した5つの格言です。

${text1}

生成した格言を笑える順に並べてください。その中から3番目の格言を選び、その格言と、その格言に合う架空の作者名をJSON形式で出力してください。
例: {"text": "石を積む者は、石を積む。", "author": "積田 積"}
`.trim();

  const result2 = await model.generateContent(prompt2);
  let responseText = result2.response.text().trim();

  // 応答テキストからJSONオブジェクトを抽出する
  const jsonStartIndex = responseText.indexOf("{");
  const jsonEndIndex = responseText.lastIndexOf("}");

  if (
    jsonStartIndex !== -1 &&
    jsonEndIndex !== -1 &&
    jsonEndIndex > jsonStartIndex
  ) {
    responseText = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
  } else {
    // JSONが見つからない場合、warnを出して元のresponseTextをそのまま使う（フォールバック）
    console.warn(
      "Gemini のレスポンスに有効なJSONオブジェクトが見つからなかったよ:",
      result2.response.text().trim()
    );
    // フォールバック処理のために元のresponseTextを保持
    // ただし、以前の ``` ガードは不要になるため削除
  }

  try {
    const parsed = JSON.parse(responseText);
    if (parsed.text && parsed.author) {
      return { text: parsed.text, author: parsed.author };
    }
  } catch (e) {
    console.warn(
      "Gemini のレスポンスをJSONとしてパースできなかったよ:",
      responseText
    );
  }

  // JSONパースに失敗した場合のフォールバック
  // 以前のロジックをベースに格言だけを抽出
  let proverb = responseText;
  proverb = proverb.replace(/^\s*\d+[\.\u3001\)]\s*/, "");
  return { text: proverb, author: "Unknown" };
}

async function main() {
  const quotes = loadQuotes();
  const newQuoteData = await generateQuoteWithTwoCalls();

  const nextIdNum = quotes.length + 1;
  const newId = `q-${String(nextIdNum).padStart(3, "0")}`;

  quotes.push({
    id: newId,
    text: newQuoteData.text,
    author: newQuoteData.author,
  });

  fs.writeFileSync(quotesPath, JSON.stringify(quotes, null, 2) + "\n", "utf-8");
  fs.writeFileSync(
    publicQuotesPath,
    JSON.stringify(quotes, null, 2) + "\n",
    "utf-8"
  );

  console.log("新しい格言を追加したよ:", newQuoteData.text);
  console.log("作者:", newQuoteData.author);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
