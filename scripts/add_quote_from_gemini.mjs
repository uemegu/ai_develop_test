import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const quotesPath = path.join(__dirname, "..", "docs", "quotes.json");

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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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

生成した格言を笑える順に並べてください。そしてその中から3番目の格言を出力してください。
出力は格言の番号等も含めず、格言だけを出力するようにしてください。
`.trim();

  const result2 = await model.generateContent(prompt2);
  let proverb = result2.response.text().trim();

  // 念のため、番号や「1. 」とかが混ざってたら軽く掃除
  // - 行頭の数字+ドット/カッコ/スペースを削る
  proverb = proverb.replace(/^\s*\d+[\.\u3001\)]\s*/, "");

  // もし ``` で囲まれて返ってきた場合のガード
  proverb = proverb
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/```$/m, "")
    .trim();

  return proverb;
}

async function main() {
  const quotes = loadQuotes();
  const newQuoteText = await generateQuoteWithTwoCalls();

  // quotes.json の形式が
  //   ["格言1", "格言2", ...]
  // ならそのまま string を push でOK
  // もし
  //   [{ "text": "格言1" }, ...]
  // みたいなオブジェクト配列なら、必要に応じてここを調整してね。

  if (
    quotes.length > 0 &&
    typeof quotes[0] === "object" &&
    quotes[0] !== null
  ) {
    // オブジェクト形式の場合の雑な例
    quotes.push({ text: newQuoteText });
  } else {
    // 文字列配列の場合
    quotes.push(newQuoteText);
  }

  fs.writeFileSync(quotesPath, JSON.stringify(quotes, null, 2) + "\n", "utf-8");

  console.log("新しい格言を追加したよ:", newQuoteText);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
