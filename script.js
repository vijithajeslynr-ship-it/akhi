const THEME_KEY = "luxe_theme";
let currentUser = null;
let products = [];

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function showToast(message, type = "info") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function productCard(product) {
  return `
    <article class="product-card fade-in">
      <img src="${product.image}" alt="${product.name}">
      <div class="card-body">
        <h3>${product.name}</h3>
        <div class="price-line">
          <span class="price">Rs. ${product.price}</span>
          <span class="rating">★ ${product.rating}</span>
        </div>
        <div class="card-actions">
          <button class="add-cart" data-id="${product.id}" type="button">Add to Cart</button>
          <a href="product.html?id=${product.id}">Details</a>
        </div>
      </div>
    </article>
  `;
}

function setCartCount(count) {
  document.querySelectorAll("#cart-count").forEach((el) => {
    el.textContent = count;
  });
}

async function refreshCartCount() {
  if (!currentUser) {
    setCartCount(0);
    return;
  }
  try {
    const data = await api("/api/cart");
    setCartCount(data.count);
  } catch {
    setCartCount(0);
  }
}

async function addToCart(productId) {
  if (!currentUser) {
    showToast("Please login to add items to cart", "error");
    setTimeout(() => (window.location.href = "auth.html"), 1200);
    return;
  }
  try {
    const data = await api("/api/cart", {
      method: "POST",
      body: JSON.stringify({ productId: Number(productId) })
    });
    setCartCount(data.count);
    showToast("Added to cart!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function bindCartButtons(root = document) {
  root.querySelectorAll(".add-cart").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id || "1"));
  });
}

async function loadProducts() {
  try {
    const data = await api("/api/products");
    products = data.products;
  } catch {
    products = [];
  }
}

function renderHomeSection(id, category) {
  const grid = document.getElementById(id);
  if (!grid) return;
  const items = products.filter((item) => item.category === category);
  grid.innerHTML = items.map(productCard).join("");
  bindCartButtons(grid);
}

function setupSearch() {
  const input = document.getElementById("search-input");
  const trendingGrid = document.getElementById("trending-grid");
  if (!input || !trendingGrid) return;

  input.addEventListener("input", async () => {
    const value = input.value.trim();
    try {
      const url = value ? `/api/products?q=${encodeURIComponent(value)}` : "/api/products";
      const data = await api(url);
      trendingGrid.innerHTML = data.products.map(productCard).join("");
      bindCartButtons(trendingGrid);
    } catch {
      trendingGrid.innerHTML = "<p class='muted'>No products found.</p>";
    }
  });
}

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") document.body.classList.add("dark");

  if (!toggle) return;
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  });
}

async function loadUser() {
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
    updateProfileUI();
  } catch {
    currentUser = null;
  }
}

function updateProfileUI() {
  document.querySelectorAll(".profile-chip").forEach((el) => {
    if (currentUser) {
      el.textContent = `👤 ${currentUser.name}`;
      el.href = "#";
      el.onclick = (e) => {
        e.preventDefault();
        if (confirm("Logout from your account?")) logout();
      };
    } else {
      el.textContent = "👤 Account";
      el.href = "auth.html";
      el.onclick = null;
    }
  });
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  currentUser = null;
  setCartCount(0);
  window.location.href = "index.html";
}

async function loadCartPage() {
  const list = document.getElementById("cart-list");
  const totalEl = document.getElementById("cart-total");
  if (!list) return;

  if (!currentUser) {
    list.innerHTML = `<p class="muted">Please <a href="auth.html">login</a> to view your cart.</p>`;
    if (totalEl) totalEl.textContent = "Rs. 0";
    return;
  }

  try {
    const data = await api("/api/cart");
    if (!data.cart.length) {
      list.innerHTML = "<p class='muted'>Your cart is empty.</p>";
      if (totalEl) totalEl.textContent = "Rs. 0";
      return;
    }

    list.innerHTML = data.cart
      .map(
        (item) => `
      <div class="list-item">
        <span>${item.name} × ${item.quantity}</span>
        <div class="item-actions">
          <strong>Rs. ${item.price * item.quantity}</strong>
          <button class="btn-remove" data-id="${item.productId}" type="button">Remove</button>
        </div>
      </div>
    `
      )
      .join("");

    if (totalEl) totalEl.textContent = `Rs. ${data.total}`;

    list.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/cart/${btn.dataset.id}`, { method: "DELETE" });
        await loadCartPage();
        await refreshCartCount();
        showToast("Item removed", "success");
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadWishlistPage() {
  const list = document.getElementById("wishlist-list");
  if (!list) return;

  if (!currentUser) {
    list.innerHTML = `<p class="muted">Please <a href="auth.html">login</a> to view wishlist.</p>`;
    return;
  }

  try {
    const data = await api("/api/wishlist");
    if (!data.wishlist.length) {
      list.innerHTML = "<p class='muted'>Your wishlist is empty.</p>";
      return;
    }

    list.innerHTML = data.wishlist
      .map(
        (item) => `
      <div class="list-item">
        <span>${item.name} — Rs. ${item.price}</span>
        <div class="item-actions">
          <button class="add-cart" data-id="${item.productId}" type="button">Add to Cart</button>
          <button class="btn-remove" data-id="${item.productId}" type="button">Remove</button>
        </div>
      </div>
    `
      )
      .join("");

    bindCartButtons(list);
    list.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/wishlist/${btn.dataset.id}`, { method: "DELETE" });
        await loadWishlistPage();
        showToast("Removed from wishlist", "success");
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadProductPage() {
  const layout = document.getElementById("product-detail");
  if (!layout) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id") || "1";

  try {
    const data = await api(`/api/products/${id}`);
    const p = data.product;
    layout.innerHTML = `
      <div class="detail-image panel fade-in">
        <img src="${p.image}" alt="${p.name}" />
      </div>
      <article class="panel fade-in">
        <span class="tag">${p.category}</span>
        <h1>${p.name}</h1>
        <p class="muted">${p.description}</p>
        <p class="rating">★★★★★ ${p.rating}</p>
        <h2>Rs. ${p.price}</h2>
        <div class="card-actions">
          <button class="add-cart" data-id="${p.id}" type="button">Add to Cart</button>
          <button class="add-wishlist" data-id="${p.id}" type="button">Add to Wishlist</button>
        </div>
        <hr />
        <ul class="muted">
          <li>Free shipping above Rs. 999</li>
          <li>7-day easy returns</li>
          <li>Secure payment and tracking</li>
        </ul>
      </article>
    `;

    bindCartButtons(layout);
    layout.querySelector(".add-wishlist")?.addEventListener("click", async () => {
      if (!currentUser) {
        showToast("Please login first", "error");
        setTimeout(() => (window.location.href = "auth.html"), 1200);
        return;
      }
      try {
        await api("/api/wishlist", {
          method: "POST",
          body: JSON.stringify({ productId: p.id })
        });
        showToast("Added to wishlist!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  } catch {
    layout.innerHTML = "<p class='muted'>Product not found.</p>";
  }
}

async function loadCheckoutPage() {
  const summary = document.getElementById("order-summary");
  if (!summary) return;

  if (!currentUser) {
    summary.innerHTML = `<p class="muted">Please <a href="auth.html">login</a> to checkout.</p>`;
    return;
  }

  try {
    const data = await api("/api/cart");
    const shipping = 99;
    const total = data.total + shipping;

    if (!data.cart.length) {
      summary.innerHTML = "<p class='muted'>Your cart is empty. Add products first.</p>";
      return;
    }

    summary.innerHTML = `
      ${data.cart
        .map(
          (item) =>
            `<div class="list-item"><span>${item.name} × ${item.quantity}</span><strong>Rs. ${item.price * item.quantity}</strong></div>`
        )
        .join("")}
      <div class="list-item"><span>Shipping</span><strong>Rs. ${shipping}</strong></div>
      <div class="list-item"><strong>Total Payable</strong><strong>Rs. ${total}</strong></div>
    `;
  } catch (err) {
    summary.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

function setupCheckoutForm() {
  const form = document.getElementById("checkout-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showToast("Please login first", "error");
      return;
    }

    const formData = new FormData(form);
    try {
      const data = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          address: formData.get("address"),
          delivery: formData.get("delivery"),
          payment: formData.get("payment")
        })
      });
      showToast(`Order #${data.order.id} placed successfully!`, "success");
      await refreshCartCount();
      setTimeout(() => (window.location.href = "index.html"), 2000);
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

function authTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const title = document.getElementById("auth-title");
  const nameField = document.getElementById("auth-name");
  if (!tabs.length || !title) return;

  let mode = "login";
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.mode;
      title.textContent = mode === "signup" ? "Create account" : "Welcome back";
      if (nameField) nameField.style.display = mode === "signup" ? "block" : "none";
    });
  });

  const form = document.getElementById("auth-form");
  const msg = document.getElementById("auth-message");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const email = formData.get("email");
    const password = formData.get("password");
    const name = formData.get("name");

    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "signup" ? { email, password, name } : { email, password };
      const data = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      currentUser = data.user;
      if (msg) {
        msg.textContent = `Welcome, ${data.user.name}! Redirecting...`;
        msg.className = "auth-message success";
      }
      showToast("Login successful!", "success");
      setTimeout(() => (window.location.href = "index.html"), 1000);
    } catch (err) {
      if (msg) {
        msg.textContent = err.message;
        msg.className = "auth-message error";
      }
      showToast(err.message, "error");
    }
  });
}

async function init() {
  initTheme();
  await loadUser();
  await loadProducts();
  renderHomeSection("trending-grid", "trending");
  renderHomeSection("best-grid", "best");
  renderHomeSection("new-grid", "new");
  setupSearch();
  await refreshCartCount();
  await loadCartPage();
  await loadWishlistPage();
  await loadProductPage();
  await loadCheckoutPage();
  setupCheckoutForm();
  authTabs();
}

init();
