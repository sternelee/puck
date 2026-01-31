import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { PageData } from "./get-page";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.join(__dirname, "../../database.json");

type Database = {
  pages: Record<string, PageData>;
};

export function savePage(
  path: string,
  data: PageData
): { success: boolean; error?: string } {
  try {
    // Read existing database or create new one
    let db: Database = { pages: {} };

    if (fs.existsSync(databasePath)) {
      db = JSON.parse(fs.readFileSync(databasePath, "utf-8"));
    }

    // Remove leading slash and normalize
    const normalizedPath = path.replace(/^\//, "") || "/";

    // Update page data
    db.pages[normalizedPath] = data;

    // Write back to file
    fs.writeFileSync(databasePath, JSON.stringify(db, null, 2));

    return { success: true };
  } catch (error) {
    console.error("Error saving page data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
