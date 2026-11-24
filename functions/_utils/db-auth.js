export function buildCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const isAllowedOrigin = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*satinau\.cn(?::\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "https://satinau.cn",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

export function json(cors, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function error(cors, msg, status = 400) {
  return json(cors, { error: msg }, status);
}

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
}

export function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
}

export function verifyToken(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  try {
    const token = authHeader.split(" ")[1];
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return { id: payload.uid };
  } catch {
    return null;
  }
}

export async function validateTurnstile(token, secretKey, ip) {
  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (ip) formData.append("remoteip", ip);
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    });
    const outcome = await result.json();
    return Boolean(outcome.success);
  } catch (e) {
    console.error("Turnstile validation error:", e);
    return false;
  }
}
