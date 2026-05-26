# LuxeCart — Real Shopping Website

A real website with **login, database, cart, wishlist, and checkout**.

## How to run

### Option A — Double-click (easiest)
1. Install Node.js from https://nodejs.org (LTS version)
2. Double-click **`start.bat`**
3. Open **http://localhost:3000** in your browser

### Option B — Terminal in Cursor
```bash
node server.js
```
Then open **http://localhost:3000**

> **Important:** Do not open `index.html` by double-clicking. Always use `http://localhost:3000`.

## Demo login

| Email | Password |
|-------|----------|
| `demo@luxecart.com` | `demo123` |

Or click **Signup** to create your own account.

## What works

- Real signup and login (encrypted passwords)
- Cart saved per user in database
- Wishlist
- Checkout creates real orders
- Product search
- Dark mode

## Files

- `server.js` — backend server
- `db.js` — database logic
- `data/db.json` — your data (created automatically)
- `index.html`, `auth.html`, etc. — pages
- `script.js` — connects pages to server

## Deploy on Vercel

1. Push this repo to GitHub
2. In Vercel → Project **Settings** → **General**:
   - **Framework Preset:** Other
   - **Build Command:** (leave empty)
   - **Output Directory:** `.`
3. Redeploy

Login on live site: `demo@luxecart.com` / `demo123`

> If you see "Create Next App", the wrong framework is selected — set Framework to **Other** and redeploy.
