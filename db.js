const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "luxecart-data")
  : path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const SEED_PRODUCTS = [
  {
    id: 1,
    name: "AirFlex Runner",
    price: 3499,
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    category: "trending",
    description:
      "Lightweight premium running shoes with comfort-foam sole and breathable knit upper."
  },
  {
    id: 2,
    name: "Nova Smart Watch",
    price: 5999,
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    category: "best",
    description: "Track fitness, notifications, and sleep with a sleek AMOLED display."
  },
  {
    id: 3,
    name: "Urban Leather Bag",
    price: 4299,
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80",
    category: "new",
    description: "Handcrafted leather bag with padded laptop sleeve and magnetic closure."
  },
  {
    id: 4,
    name: "Minimal Hoodie",
    price: 2199,
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    category: "trending",
    description: "Soft cotton-blend hoodie with minimalist cut and premium finish."
  },
  {
    id: 5,
    name: "Noise-Cancel Headphones",
    price: 7999,
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80",
    category: "best",
    description: "Studio-grade sound with active noise cancellation and 30-hour battery."
  },
  {
    id: 6,
    name: "Pixel Glasses",
    price: 2699,
    rating: 4.4,
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=80",
    category: "new",
    description: "UV-protected lenses with lightweight acetate frames for all-day comfort."
  }
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === test;
}

function defaultDb() {
  return {
    users: [],
    products: SEED_PRODUCTS,
    carts: {},
    wishlists: {},
    orders: [],
    sessions: {},
    nextUserId: 1,
    nextOrderId: 1
  };
}

function getSessionUserId(sid) {
  if (!sid) return null;
  const db = readDb();
  if (!db.sessions) return null;
  const session = db.sessions[sid];
  if (!session) return null;
  if (session.expires < Date.now()) {
    delete db.sessions[sid];
    writeDb(db);
    return null;
  }
  return session.userId;
}

function createSession(userId) {
  const db = readDb();
  if (!db.sessions) db.sessions = {};
  const sid = crypto.randomBytes(24).toString("hex");
  db.sessions[sid] = {
    userId,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  writeDb(db);
  return sid;
}

function destroySession(sid) {
  if (!sid) return;
  const db = readDb();
  if (!db.sessions) return;
  delete db.sessions[sid];
  writeDb(db);
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDb();
    db.users.push({
      id: 1,
      email: "demo@luxecart.com",
      password: hashPassword("demo123"),
      name: "Demo User"
    });
    db.nextUserId = 2;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getProducts() {
  return readDb().products;
}

function getProductById(id) {
  return readDb().products.find((p) => p.id === Number(id));
}

function findUserByEmail(email) {
  return readDb().users.find((u) => u.email === email.toLowerCase());
}

function findUserById(id) {
  return readDb().users.find((u) => u.id === Number(id));
}

function createUser({ email, password, name }) {
  const db = readDb();
  if (db.users.some((u) => u.email === email.toLowerCase())) {
    return { error: "Email already registered" };
  }
  const user = {
    id: db.nextUserId,
    email: email.toLowerCase(),
    password: hashPassword(password),
    name: name || email.split("@")[0]
  };
  db.users.push(user);
  db.nextUserId += 1;
  writeDb(db);
  return { user: { id: user.id, email: user.email, name: user.name } };
}

function verifyUser(email, password) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password)) {
    return { error: "Invalid email or password" };
  }
  return { user: { id: user.id, email: user.email, name: user.name } };
}

function getCart(userId) {
  const db = readDb();
  return (db.carts[userId] || []).map((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      name: product.name,
      price: product.price,
      image: product.image
    };
  });
}

function addToCart(userId, productId) {
  const db = readDb();
  if (!db.products.some((p) => p.id === Number(productId))) {
    return { error: "Product not found" };
  }
  if (!db.carts[userId]) db.carts[userId] = [];
  const existing = db.carts[userId].find((i) => i.productId === Number(productId));
  if (existing) existing.quantity += 1;
  else db.carts[userId].push({ productId: Number(productId), quantity: 1 });
  writeDb(db);
  return { cart: getCart(userId) };
}

function removeFromCart(userId, productId) {
  const db = readDb();
  if (db.carts[userId]) {
    db.carts[userId] = db.carts[userId].filter((i) => i.productId !== Number(productId));
    writeDb(db);
  }
  return { cart: getCart(userId) };
}

function getWishlist(userId) {
  const db = readDb();
  return (db.wishlists[userId] || [])
    .map((id) => db.products.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ productId: p.id, name: p.name, price: p.price, image: p.image }));
}

function addToWishlist(userId, productId) {
  const db = readDb();
  if (!db.products.some((p) => p.id === Number(productId))) {
    return { error: "Product not found" };
  }
  if (!db.wishlists[userId]) db.wishlists[userId] = [];
  const pid = Number(productId);
  if (!db.wishlists[userId].includes(pid)) db.wishlists[userId].push(pid);
  writeDb(db);
  return { wishlist: getWishlist(userId) };
}

function removeFromWishlist(userId, productId) {
  const db = readDb();
  if (db.wishlists[userId]) {
    db.wishlists[userId] = db.wishlists[userId].filter((id) => id !== Number(productId));
    writeDb(db);
  }
  return { wishlist: getWishlist(userId) };
}

function createOrder(userId, { name, email, address, delivery, payment }) {
  const cart = getCart(userId);
  if (!cart.length) return { error: "Cart is empty" };
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = delivery === "express" ? 199 : 99;
  const db = readDb();
  const order = {
    id: db.nextOrderId,
    userId,
    items: cart.map((i) => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity
    })),
    customer: { name, email, address },
    delivery,
    payment,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: "confirmed",
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  db.nextOrderId += 1;
  db.carts[userId] = [];
  writeDb(db);
  return { order };
}

module.exports = {
  getProducts,
  getProductById,
  findUserById,
  createUser,
  verifyUser,
  getCart,
  addToCart,
  removeFromCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  createOrder,
  getSessionUserId,
  createSession,
  destroySession
};
