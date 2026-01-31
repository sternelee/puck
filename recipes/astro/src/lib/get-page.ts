import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.join(__dirname, "../../database.json");

export type PageData = {
  root: { props: { title?: string } };
  content: any[];
  zones?: Record<string, any[]>;
};

export function getPage(path: string): PageData | null {
  try {
    const db = JSON.parse(fs.readFileSync(databasePath, "utf-8"));

    // Remove leading slash and normalize
    const normalizedPath = path.replace(/^\//, "") || "/";

    return db.pages[normalizedPath] || null;
  } catch (error) {
    console.error("Error reading page data:", error);
    return null;
  }
}

export function getAllPages() {
  try {
    const db = JSON.parse(fs.readFileSync(databasePath, "utf-8"));
    return db.pages || {};
  } catch (error) {
    console.error("Error reading page data:", error);
    return {};
  }
}
