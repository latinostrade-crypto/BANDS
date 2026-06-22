import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), "public");
const appUrl = process.env.VITE_APP_URL ?? process.env.WEB_APP_URL ?? "http://localhost:5173";
const cleanUrl = appUrl.replace(/\/$/, "");

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, "tonconnect-manifest.json"),
  JSON.stringify(
    {
      url: cleanUrl,
      name: "Bands 2",
      iconUrl: `${cleanUrl}/icon-180.png`
    },
    null,
    2
  )
);
