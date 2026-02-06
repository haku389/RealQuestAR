import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || ""; // owner/repo
const GITHUB_REF_NAME = process.env.GITHUB_REF_NAME || "main";
const GITHUB_SHA = process.env.GITHUB_SHA || "";
const GITHUB_BEFORE = process.env.GITHUB_BEFORE || "";

if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID (check Actions secrets).");
  process.exit(1);
}

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

// ===== Notion property names (YOUR DB) =====
const PROP = {
  title: "fileName",
  key: "key",
  path: "path",
  code: "code",
  area: "area",
  feature: "feature",
  type: "type",
  status: "status",
  updateAt: "updateAt",
};

// ===== Helpers =====
function notionHeaders() {
  return {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch(url, options) {
  const res = await fetch(url, { ...options, headers: { ...notionHeaders(), ...(options.headers || {}) } });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error("Notion API Error:", res.status, json);
    throw new Error(`Notion API failed: ${res.status}`);
  }
  return json;
}

function chunkString(str, size = 1800) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

// Notion rich_text expects array of objects
function richTextFromString(str) {
  const chunks = chunkString(str, 1800);
  return chunks.map((c) => ({ type: "text", text: { content: c } }));
}

function makeKey(repoName, branch, filePath) {
  return `${repoName}:${branch}:${filePath}`;
}

function getRepoNameFromFull(full) {
  // "owner/repo" -> "repo"
  const parts = full.split("/");
  return parts[parts.length - 1] || full;
}

function detectArea(filePath) {
  if (filePath.startsWith("RealQuestAR/app/")) return "app";
  if (filePath.startsWith("RealQuestAR/src/")) return "src";
  if (filePath.startsWith("RealQuestAR/assets/") || filePath.startsWith("assets/")) return "assets";

  // configs
  const base = path.basename(filePath);
  if (
    base === "app.json" ||
    base === "package.json" ||
    base === "tsconfig.json" ||
    base === "babel.config.js" ||
    base.startsWith(".env")
  )
    return "config";

  return "config";
}

function detectFeature(filePath) {
  // src/features/<feature>/*
  const m = filePath.match(/RealQuestAR\/src\/features\/([^/]+)\//);
  if (m?.[1]) return m[1];

  // app screens mapping (extend as you like)
  const base = path.basename(filePath).toLowerCase();
  if (base.includes("login")) return "auth";
  if (base.includes("reward")) return "rewards";
  if (base.includes("scan")) return "scan";

  // shared/core
  if (
    filePath.startsWith("RealQuestAR/src/services/") ||
    filePath.startsWith("RealQuestAR/src/components/") ||
    filePath.startsWith("RealQuestAR/src/utils/") ||
    filePath.startsWith("RealQuestAR/src/constants/") ||
    filePath.startsWith("RealQuestAR/src/types/")
  ) {
    return "core";
  }

  return "core";
}

function detectType(filePath) {
  if (filePath.startsWith("RealQuestAR/app/")) return "screen";
  if (filePath.startsWith("RealQuestAR/src/services/")) return "service";
  if (filePath.startsWith("RealQuestAR/src/components/")) return "component";
  if (filePath.startsWith("RealQuestAR/src/utils/")) return "util";

  const base = path.basename(filePath).toLowerCase();
  if (base === "hooks.ts" || base.endsWith(".hooks.ts") || base.endsWith("hooks.ts")) return "hook";
  if (base === "api.ts" || base.endsWith(".api.ts") || base.endsWith("api.ts")) return "api";

  // default
  return "util";
}

function listChangedFiles() {
  // First push might have BEFORE all zeros; fallback to all tracked files
  const isFirstPush = !GITHUB_BEFORE || /^0+$/.test(GITHUB_BEFORE);
  let files = [];

  try {
    if (isFirstPush) {
      const out = execSync(`git ls-files`, { encoding: "utf8" });
      files = out.split("\n").map((s) => s.trim()).filter(Boolean);
    } else {
      const out = execSync(`git diff --name-only ${GITHUB_BEFORE} ${GITHUB_SHA}`, { encoding: "utf8" });
      files = out.split("\n").map((s) => s.trim()).filter(Boolean);
    }
  } catch (e) {
    console.error("Failed to get changed files:", e);
    process.exit(1);
  }

  // Only sync text-like files (you can adjust)
  const allowExt = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml", ".txt"]);
  files = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    if (!allowExt.has(ext)) return false;
    // ignore huge vendor folders
    if (f.includes("node_modules/")) return false;
    return true;
  });

  return files;
}

async function queryPageByKey(keyValue) {
  const body = {
    filter: {
      property: PROP.key,
      rich_text: { equals: keyValue },
    },
  };
  const json = await notionFetch(`${NOTION_API}/databases/${NOTION_DATABASE_ID}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return json.results?.[0] || null;
}

function buildProperties({ title, keyValue, pathValue, codeValue, area, feature, type, status }) {
  const props = {};

  props[PROP.title] = { title: [{ type: "text", text: { content: title } }] };
  props[PROP.key] = { rich_text: richTextFromString(keyValue) };
  props[PROP.path] = { rich_text: richTextFromString(pathValue) };

  // code: put full code as rich_text chunks
  props[PROP.code] = { rich_text: richTextFromString(codeValue) };

  props[PROP.area] = { select: { name: area } };
  props[PROP.feature] = { select: { name: feature } };
  props[PROP.type] = { select: { name: type } };

  if (status) props[PROP.status] = { select: { name: status } };

  return props;
}

async function createPage(props) {
  return notionFetch(`${NOTION_API}/pages`, {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: props,
    }),
  });
}

async function updatePage(pageId, props) {
  return notionFetch(`${NOTION_API}/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: props }),
  });
}

async function main() {
  const repoName = getRepoNameFromFull(GITHUB_REPOSITORY);

  const files = listChangedFiles();
  if (files.length === 0) {
    console.log("No files to sync.");
    return;
  }

  console.log("Files to sync:", files);

  for (const f of files) {
    // Read file contents
    let content = "";
    try {
      content = fs.readFileSync(f, "utf8");
    } catch {
      console.log(`Skip unreadable file: ${f}`);
      continue;
    }

    const title = path.basename(f); // fileName
    const keyValue = makeKey(repoName, GITHUB_REF_NAME, f);
    const pathValue = f;

    const area = detectArea(f);
    const feature = detectFeature(f);
    const type = detectType(f);

    // If you want default status on create:
    const defaultStatusOnCreate = "Not started";

    // Upsert
    const existing = await queryPageByKey(keyValue);
    if (existing?.id) {
      // keep existing status if you prefer: do not overwrite status
      const props = buildProperties({
        title,
        keyValue,
        pathValue,
        codeValue: content,
        area,
        feature,
        type,
        status: null, // do not overwrite status on update
      });
      await updatePage(existing.id, props);
      console.log(`Updated: ${keyValue}`);
    } else {
      const props = buildProperties({
        title,
        keyValue,
        pathValue,
        codeValue: content,
        area,
        feature,
        type,
        status: defaultStatusOnCreate,
      });
      await createPage(props);
      console.log(`Created: ${keyValue}`);
    }

    // Avoid rate limit bursts
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
