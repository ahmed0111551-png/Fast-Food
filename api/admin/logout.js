import { originIsSame, sendJson, setSessionCookie } from "../../lib/admin-api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!originIsSame(req)) return sendJson(res, 403, { error: "Request origin was rejected." });

  setSessionCookie(req, res, "", 0);
  return sendJson(res, 200, { ok: true });
}
