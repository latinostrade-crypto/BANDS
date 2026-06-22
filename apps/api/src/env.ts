import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const file of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    break;
  }
}
