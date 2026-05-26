const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const sessions = new Map();

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function getSessionId(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/sid=([^;]+)/);
  return match ? match[1] : null;
}

function getUserId(req) {
  const sid = getSessionId(req);
  return sid && sessions.get(sid) ? sessions.get(sid).userId : null;
}

function setSession(res, userId) {
  const sid = crypto.randomBytes(24).toString("hex");
  sessions.set(sid, { userId, created: Date.now() });
  res.setHeader(
    "Set-Cookie",
    `sid=${sid}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
  );
}

function clearSession(req, res) {
  const sid = getSessionId(req);
  if (sid) sessions.delete(sid);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; Max-Age=0");
}

function serveStatic(req, res) {
  let filePath = path.join(ROOT, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    const body = req.method === "POST" || req.method === "DELETE" ? await parseBody(req) : {};
    const userId = getUserId(req);

    if (pathname === "/api/products" && req.method === "GET") {
      let products = db.getProducts();
      const q = url.searchParams.get("q");
      const category = url.searchParams.get("category");
      if (category) products = products.filter((p) => p.category === category);
      if (q) {
        const term = q.toLowerCase();
        products = products.filter((p) => p.name.toLowerCase().includes(term));
      }
      return send(res, 200, { products });
    }

    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === "GET") {
      const product = db.getProductById(productMatch[1]);
      if (!product) return send(res, 404, { error: "Product not found" });
      return send(res, 200, { product });
    }

    if (pathname === "/api/auth/me" && req.method === "GET") {
      if (!userId) return send(res, 200, { user: null });
      const user = db.findUserById(userId);
      if (!user) return send(res, 200, { user: null });
      return send(res, 200, { user: { id: user.id, email: user.email, name: user.name } });
    }

    if (pathname === "/api/auth/register" && req.method === "POST") {
      if (!body.email || !body.password) {
        return send(res, 400, { error: "Email and password are required" });
      }
      if (body.password.length < 6) {
        return send(res, 400, { error: "Password must be at least 6 characters" });
      }
      const result = db.createUser(body);
      if (result.error) return send(res, 400, { error: result.error });
      setSession(res, result.user.id);
      return send(res, 200, { user: result.user });
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      const result = db.verifyUser(body.email, body.password);
      if (result.error) return send(res, 401, { error: result.error });
      setSession(res, result.user.id);
      return send(res, 200, { user: result.user });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      clearSession(req, res);
      return send(res, 200, { ok: true });
    }

    if (!userId) return send(res, 401, { error: "Please login first" });

    if (pathname === "/api/cart" && req.method === "GET") {
      const cart = db.getCart(userId);
      const count = cart.reduce((s, i) => s + i.quantity, 0);
      const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      return send(res, 200, { cart, count, total });
    }

    if (pathname === "/api/cart" && req.method === "POST") {
      const result = db.addToCart(userId, body.productId);
      if (result.error) return send(res, 404, { error: result.error });
      const count = result.cart.reduce((s, i) => s + i.quantity, 0);
      return send(res, 200, { cart: result.cart, count });
    }

    const cartDel = pathname.match(/^\/api\/cart\/(\d+)$/);
    if (cartDel && req.method === "DELETE") {
      const result = db.removeFromCart(userId, cartDel[1]);
      const count = result.cart.reduce((s, i) => s + i.quantity, 0);
      const total = result.cart.reduce((s, i) => s + i.price * i.quantity, 0);
      return send(res, 200, { cart: result.cart, count, total });
    }

    if (pathname === "/api/wishlist" && req.method === "GET") {
      return send(res, 200, { wishlist: db.getWishlist(userId) });
    }

    if (pathname === "/api/wishlist" && req.method === "POST") {
      const result = db.addToWishlist(userId, body.productId);
      if (result.error) return send(res, 404, { error: result.error });
      return send(res, 200, { wishlist: result.wishlist });
    }

    const wishDel = pathname.match(/^\/api\/wishlist\/(\d+)$/);
    if (wishDel && req.method === "DELETE") {
      const result = db.removeFromWishlist(userId, wishDel[1]);
      return send(res, 200, { wishlist: result.wishlist });
    }

    if (pathname === "/api/orders" && req.method === "POST") {
      if (!body.name || !body.email || !body.address) {
        return send(res, 400, { error: "Name, email, and address are required" });
      }
      const result = db.createOrder(userId, body);
      if (result.error) return send(res, 400, { error: result.error });
      return send(res, 200, { order: result.order });
    }

    return send(res, 404, { error: "Not found" });
  }

  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405);
  res.end();
});

server.listen(PORT, () => {
  console.log(`LuxeCart running at http://localhost:${PORT}`);
  console.log("Demo login: demo@luxecart.com / demo123");
});
