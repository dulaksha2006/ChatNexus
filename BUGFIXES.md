# ChatZY — Bug Fix Log

## 🔴 Critical: Workers cannot chat with customers (SESSION BUG)

### Bug 1 — Express route shadowing: `/me/status` matched as `/:id`
**File:** `backend/routes/workers.js`  
**Problem:** `PATCH /me/status` was defined *after* `PATCH /:id`. Express matched the literal
string `"me"` as the `:id` param and routed to the wrong handler — which requires `admin` role.
Workers got `403 Forbidden` when trying to update their own status.  
**Fix:** Moved both `/me/greeting` and `/me/status` **before** `/:id`.

### Bug 2 — Express route shadowing: `/stats/overview` matched as `/:id`
**File:** `backend/routes/sessions.js`  
**Problem:** `GET /stats/overview` was defined *after* `GET /:id`. Express matched `"stats"` as
the session ID and looked up a Firestore document that doesn't exist — returning 404.  
**Fix:** Moved `/stats/overview` **before** `/:id`.

### Bug 3 — Auth token not attached on outgoing API requests
**File:** `frontend/src/api.js`  
**Problem:** The Axios instance only set the `Authorization` header in `AuthContext` after login.
On page refresh, `AuthContext` re-fetches `/auth/me` to restore the user — but the token was
being set *after* the request was already sent, causing a race condition where the first
authenticated API call would fail with 401.  
**Fix:** Added an **Axios request interceptor** that reads `localStorage.getItem('token')` and
attaches it to every outgoing request automatically.

### Bug 4 — Firestore `onSnapshot` fires before `db` is initialized
**File:** `frontend/src/pages/WorkerDashboard.jsx` and `AdminDashboard.jsx`  
**Problem:** `firebase.js` initializes Firestore asynchronously via `initFirebase()`. Components
that call `getDb()` synchronously on mount received `undefined`, causing the Firestore listener
to silently fail with no sessions loading.  
**Fix:** Added a polling loop (`dbReady` state) that waits up to 4 seconds for `getDb()` to
return a non-null value before subscribing to real-time listeners.

### Bug 5 — Firestore `orderBy` requires composite index on new deployments
**File:** `frontend/src/pages/WorkerDashboard.jsx`, `AdminDashboard.jsx`, `backend/routes/sessions.js`  
**Problem:** Queries combined `where('workerId', '==', x)` + `orderBy('createdAt', 'desc')` on
different fields. Firestore requires a manually-created composite index for this combination.
On a fresh deployment, this throws `FAILED_PRECONDITION` and sessions never load.  
**Fix:** Removed `orderBy()` from all multi-field Firestore queries. Sorting is now done in
JavaScript after fetching results — no index creation required.

### Bug 6 — Worker status never resets after session ends
**File:** `backend/bot/bot.js`  
**Problem:** When `endSession()` was called, `setWorkerStatus(session.workerId, 'free')` was
only called if the session document still had a `workerId` field. Due to Firestore write timing,
this sometimes failed silently. The worker remained in `busy` status permanently, making them
invisible to `getFreeWorker()` and preventing any new sessions from being created.  
**Fix:** Made the status reset unconditional and added error logging around it.

---

## 🟡 Feature Bugs Fixed

### Bug 7 — Quick Replies not wired up
**Problem:** The `QuickReplies` feature was referenced in spec but the API endpoints
(`/api/settings/quick-replies`) and the admin UI page were missing entirely.  
**Fix:** Added full CRUD endpoints in `settings.js` + new `QuickReplies.jsx` admin page +
quick-reply insert buttons in `WorkerDashboard.jsx`.

### Bug 8 — Blacklist not enforced in bot
**Problem:** The blacklist collection existed in the spec and settings but `bot.js` never
checked it — blacklisted users could still send messages and create sessions.  
**Fix:** Added `isBlacklisted(chatId)` check at the start of every `message` event handler
and inside `contactAgent()`.

### Bug 9 — Worker not notified of customer messages when dashboard is closed
**Problem:** Customer messages were only saved to Firestore. If a worker had the dashboard
closed, they had no way to know a customer had replied.  
**Fix:** After saving the message to Firestore, `relayToWorker()` now also sends the
customer's text message to the worker's linked Telegram account as a notification.

### Bug 10 — Worker status toggle missing from Dashboard
**Problem:** Workers had no way to toggle their own `free/busy/offline` status from the
web dashboard. The only way to change status was programmatically, leaving workers stuck
as `busy` with no chats.  
**Fix:** Added a `StatusToggle` dropdown component to the WorkerDashboard header that
calls `PATCH /api/workers/me/status`.

### Bug 11 — AdminDashboard Quick Replies route missing
**File:** `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`  
**Fix:** Added `/quick-replies` route and sidebar nav link for admin users.

