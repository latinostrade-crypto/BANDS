import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import { Bot, InlineKeyboard } from "grammy";

for (const file of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    break;
  }
}

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL;

if (!token) throw new Error("BOT_TOKEN is required");
if (!webAppUrl) throw new Error("WEB_APP_URL is required");

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard().webApp("Open Bands 2", webAppUrl);
  await ctx.reply(
    "Bands 2: contest for Telegram Gifts collectors. Open the app, sync unique gifts, climb the leaderboard, and connect a TON wallet for rewards.",
    { reply_markup: keyboard }
  );
});

bot.catch((error) => {
  console.error("Bot error", error);
});

bot.api
  .setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "Open Bands 2",
      web_app: { url: webAppUrl }
    }
  })
  .catch((error) => {
    console.error("Failed to set bot menu button", error);
  });

bot.start({
  onStart: (info) => console.log(`Bands bot started as @${info.username}`)
});

const port = Number(process.env.PORT ?? 10000);
http
  .createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  })
  .listen(port, () => {
    console.log(`Bands bot health server listening on ${port}`);
  });
