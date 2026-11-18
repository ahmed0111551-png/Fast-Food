import {
  createSessionToken,
  getClientIp,
  getRedis,
  hashKey,
  originIsSame,
  PayloadTooLargeError,
  passwordMatches,
  readJsonBody,
  sendJson,
  setSessionCookie,
} from "../../lib/admin-api.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!originIsSame(req)) return sendJson(res, 403, { error: "Request origin was rejected." });

  try {
    const body = await readJsonBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.password !== "string") {
      return sendJson(res, 400, { error: "Password is required." });
    }
    const redis = getRedis();
    const ipKey = `fastfood:login-attempts:${hashKey(getClientIp(req))}`;
    const attempts = await redis.incr(ipKey);
    if (attempts === 1) await redis.expire(ipKey, 900);
    if (attempts > 5) return sendJson(res, 429, { error: "Too many attempts. Try again in 15 minutes." });

    if (!passwordMatches(body.password)) {
      return sendJson(res, 401, { error: "Incorrect password." });
    }

    await redis.del(ipKey);
    setSessionCookie(req, res, createSessionToken());
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return sendJson(res, 413, { error: error.message });
    }
    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { error: "Request body must be valid JSON." });
    }
    console.error("Admin login failed:", error);
    return sendJson(res, 503, { error: "Admin login is not configured. Check the Vercel environment variables and Redis connection." });
  }
}
