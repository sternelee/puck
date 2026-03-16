import type { Data } from "@puckeditor/core";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "database.json");

// Replace with call to your database
export const getPage = (slug: string): Data | null => {
  const allData: Record<string, Data> | null = fs.existsSync(dbPath)
    ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
    : null;

  return allData ? (allData[slug] ?? null) : null;
};

export const savePage = (slug: string, data: Data): void => {
  const allData: Record<string, Data> = fs.existsSync(dbPath)
    ? JSON.parse(fs.readFileSync(dbPath, "utf-8"))
    : {};

  allData[slug] = data;
  fs.writeFileSync(dbPath, JSON.stringify(allData, null, 2));
};
