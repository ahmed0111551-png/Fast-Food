import {
  getRedis,
  isAuthenticated,
  normalizeStoredContent,
  originIsSame,
  PayloadTooLargeError,
  readJsonBody,
  sendJson,
  ValidationError,
  validateContent,
  CONTENT_KEY,
} from "../../lib/admin-api.js";

export default async function handler(req, res) {
  try {
    if (!isAuthenticated(req)) return sendJson(res, 401, { error: "Please sign in again." });
  } catch (error) {
    console.error("Admin session validation failed:", error);
    return sendJson(res, 503, { error: "Admin session is not configured." });
  }

  if (req.method === "GET") {
    try {
      const data = normalizeStoredContent(await getRedis().get(CONTENT_KEY));
      return sendJson(res, 200, { data });
    } catch (error) {
      console.error("Could not load admin content:", error);
      return sendJson(res, 503, { error: "Could not connect to the content database." });
    }
  }

  if (req.method === "PUT") {
    if (!originIsSame(req)) return sendJson(res, 403, { error: "Request origin was rejected." });
    try {
      const data = validateContent(await readJsonBody(req));
      await getRedis().set(CONTENT_KEY, data);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return sendJson(res, 413, { error: error.message });
      }
      if (error instanceof SyntaxError || error instanceof ValidationError) {
        return sendJson(res, 400, { error: error.message });
      }
      console.error("Could not save admin content:", error);
      return sendJson(res, 503, { error: "Could not save changes. Check the database connection." });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return sendJson(res, 405, { error: "Method not allowed." });
}
