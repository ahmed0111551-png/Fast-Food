import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";

export const CONTENT_KEY = "fastfood:site-content";
export const SESSION_COOKIE = "fastfood_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const categories = new Set(["burgers", "sides", "combos", "drinks"]);
let redisClient;

export class ValidationError extends Error {}
export class PayloadTooLargeError extends Error {}

export function getRedis() {
  if (!redisClient) redisClient = Redis.fromEnv();
  return redisClient;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function originIsSame(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin !== "string" || typeof host !== "string") return false;
  try {
    const parsedOrigin = new URL(origin);
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim()
      : process.env.VERCEL === "1" ? "https" : parsedOrigin.protocol.slice(0, -1);
    return parsedOrigin.host.toLowerCase() === host.toLowerCase() && parsedOrigin.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new PayloadTooLargeError("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(payload) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()) {
  const expires = now + SESSION_TTL_SECONDS * 1000;
  const payload = `${expires}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token, now = Date.now()) {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresText, nonce, suppliedSignature] = parts;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= now || !nonce || !suppliedSignature) return false;

  const expected = Buffer.from(signature(`${expiresText}.${nonce}`));
  const supplied = Buffer.from(suppliedSignature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function readSessionCookie(req) {
  const cookies = req.headers.cookie || "";
  const cookie = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? cookie.slice(SESSION_COOKIE.length + 1) : "";
}

export function isAuthenticated(req) {
  return verifySessionToken(readSessionCookie(req));
}

export function setSessionCookie(req, res, token, maxAge = SESSION_TTL_SECONDS) {
  const secure = process.env.VERCEL === "1" || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`,
  );
}

export function passwordMatches(password) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (typeof configuredPassword !== "string" || configuredPassword.length < 1) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }
  if (typeof password !== "string" || password.length > 256) return false;

  const submittedHash = createHash("sha256").update(password).digest();
  const configuredHash = createHash("sha256").update(configuredPassword).digest();
  return timingSafeEqual(submittedHash, configuredHash);
}

function stringField(value, label, maxLength, { required = false } = {}) {
  if (typeof value !== "string" || value.length > maxLength || (required && !value.trim())) {
    throw new ValidationError(`${label} is invalid.`);
  }
  return value.trim();
}

function safeLink(value, label) {
  const link = stringField(value, label, 2048);
  if (!link) return "";
  let parsed;
  try {
    parsed = new URL(link);
  } catch {
    throw new ValidationError(`${label} must be a complete HTTPS link.`);
  }
  if (parsed.protocol !== "https:") throw new ValidationError(`${label} must use HTTPS.`);
  return link;
}

export function validateContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Content must be an object.");
  }
  const rawTexts = input.texts || {};
  if (typeof rawTexts !== "object" || Array.isArray(rawTexts) || Object.keys(rawTexts).length > 500) {
    throw new ValidationError("Text content is invalid.");
  }
  const texts = Object.create(null);
  for (const [key, value] of Object.entries(rawTexts)) {
    if (!key || key.length > 4096 || !value || typeof value !== "object") {
      throw new ValidationError("A text entry is invalid.");
    }
    texts[key] = {
      en: stringField(value.en, "English text", 5000),
      ar: stringField(value.ar, "Arabic text", 5000),
    };
  }

  const rawSettings = input.settings || {};
  if (typeof rawSettings !== "object" || Array.isArray(rawSettings)) {
    throw new ValidationError("Restaurant settings are invalid.");
  }
  const settings = {
    restaurantName: stringField(rawSettings.restaurantName, "Restaurant name", 120, { required: true }),
    restaurantNameAr: stringField(rawSettings.restaurantNameAr, "Arabic restaurant name", 120, { required: true }),
    phone: stringField(rawSettings.phone, "Phone", 50),
    email: stringField(rawSettings.email, "Email", 254, { required: true }),
    instagram: safeLink(rawSettings.instagram, "Instagram"),
    facebook: safeLink(rawSettings.facebook, "Facebook"),
    tiktok: safeLink(rawSettings.tiktok, "TikTok"),
    currencySymbol: stringField(rawSettings.currencySymbol, "Currency symbol", 8, { required: true }),
  };
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    throw new ValidationError("Email is invalid.");
  }

  if (!Array.isArray(input.menu) || input.menu.length > 100) {
    throw new ValidationError("Menu must be a list of up to 100 items.");
  }
  const ids = new Set();
  const menu = input.menu.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ValidationError("A menu item is invalid.");
    }
    const id = stringField(item.id, "Menu item ID", 80, { required: true });
    if (ids.has(id)) throw new ValidationError("Menu item IDs must be unique.");
    ids.add(id);
    if (!categories.has(item.category)) throw new ValidationError("A menu category is invalid.");
    const price = Number(item.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new ValidationError("A menu price is invalid.");

    const image = stringField(item.image, "Menu image", 2048, { required: true });
    if (image.startsWith("//") || image.split("/").includes("..")) {
      throw new ValidationError("A menu image path is invalid.");
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(image)) {
      let parsedImage;
      try {
        parsedImage = new URL(image);
      } catch {
        throw new ValidationError("Menu image URL is invalid.");
      }
      if (parsedImage.protocol !== "https:" || !parsedImage.hostname) {
        throw new ValidationError("Menu images must use HTTPS.");
      }
    } else if (!/^[A-Za-z0-9_./-]+$/.test(image)) {
      throw new ValidationError("A menu image path is invalid.");
    }

    return {
      id,
      category: item.category,
      nameEn: stringField(item.nameEn, "English menu name", 160, { required: true }),
      nameAr: stringField(item.nameAr, "Arabic menu name", 160, { required: true }),
      descriptionEn: stringField(item.descriptionEn, "English description", 1000),
      descriptionAr: stringField(item.descriptionAr, "Arabic description", 1000),
      price,
      priceSuffix: stringField(item.priceSuffix || "", "Price suffix", 12),
      image,
      badgeEn: stringField(item.badgeEn || "", "English badge", 80),
      badgeAr: stringField(item.badgeAr || "", "Arabic badge", 80),
      badgeStyle: item.badgeStyle === "new" || item.badgeStyle === "deal" ? item.badgeStyle : "",
      metaIcon: stringField(item.metaIcon || "", "Menu icon", 12),
      metaEn: stringField(item.metaEn || "", "English menu note", 100),
      metaAr: stringField(item.metaAr || "", "Arabic menu note", 100),
    };
  });

  return { texts, settings, menu };
}

export function normalizeStoredContent(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === "string") {
    value = JSON.parse(value);
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored site content is invalid.");
  }
  return value;
}

export function getClientIp(req) {
  const forwarded = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0].trim().slice(0, 100) : "unknown";
}

export function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}
