import { CONTENT_KEY, getRedis, normalizeStoredContent, sendJson } from "../lib/admin-api.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const data = normalizeStoredContent(await getRedis().get(CONTENT_KEY));
    return sendJson(res, 200, data);
  } catch (error) {
    console.error("Could not load public site content:", error);
    return sendJson(res, 503, { error: "Site content database is not configured." });
  }
}
