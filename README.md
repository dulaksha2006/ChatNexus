# 🤖 Telegram Customer Support System

A full-stack enterprise-grade Telegram Customer Support platform with a real-time Web Dashboard for Admins and Workers.

---

## 📦 Stack

| Layer       | Technology                         |
|-------------|-----------------------------------|
| Backend     | Node.js + Express                  |
| Bot         | grammY (Telegram Bot API)          |
| Database    | Firebase Firestore                 |
| Storage     | Firebase Storage                   |
| Frontend    | React + Vite + Tailwind CSS (dark) |
| PDF Engine  | pdfkit                             |
| Email       | Nodemailer                         |
| Auth        | JWT + bcrypt                       |

---

## 🗂️ Firestore Schema

```
configs/
  system                         ← System-wide config
    setupComplete: bool
    botToken: string
    channelId: string
    appName: string
    adminId: string
    smtp: { host, port, user, pass, from, secure }

users/
  {userId}
    name: string
    email: string
    password: string (bcrypt)
    role: "admin" | "worker"
    active: bool
    emailVerified: bool
    telegramVerified: bool
    telegramChatId: string
    status: "free" | "busy" | "offline"
    createdAt: Timestamp

sessions/
  {sessionId}
    customerTelegramId: string
    customerUsername: string
    customerFirstName: string
    workerId: string
    workerTelegramId: string
    workerName: string
    language: string (e.g. "en")
    status: "active" | "closed"
    createdAt: Timestamp
    closedAt: Timestamp
    lastMessageAt: Timestamp

  sessions/{sessionId}/messages/
    {messageId}
      from: "customer" | "worker"
      type: "text" | "image" | "voice" | "video" | "document"
      content: string
      senderName: string
      fileId: string          (Telegram file_id)
      fileUrl: string         (direct URL)
      fileName: string        (for documents)
      duration: number        (for voice)
      telegramMessageId: number
      timestamp: Timestamp

languages/
  {langCode}               ← e.g. "en", "fr", "si"
    code: string
    name: string
    flag: string (emoji)
    active: bool
    createdAt: Timestamp

botTexts/
  {langCode}
    welcome: string
    selectLanguage: string
    noWorkers: string
    sessionStarted: string
    sessionEndedCustomer: string
    sessionEndedManual: string
    sessionEndedTimeout: string
    alreadyInSession: string
    otpMessage: string
    resetOtp: string

pendingOtps/
  {autoId}
    userId: string
    otp: string
    type: "telegram_verify" | "password_reset"
    telegramChatId: string (for telegram_verify)
    used: bool
    createdAt: Timestamp
    expiresAt: Timestamp

emailVerifications/
  {token}
    userId: string
    email: string
    expiresAt: Timestamp
```

---

## 🚀 Quick Start

### 1. Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (production mode)
3. Enable **Storage**
4. Go to **Project Settings → Service Accounts** → Generate a new private key
5. Save as `backend/firebase-service-account.json`
6. Get your **Web SDK config** from Project Settings → General

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET and FIREBASE_STORAGE_BUCKET
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env — add all VITE_FIREBASE_* values from Firebase console
npm install
npm run dev
```

### 4. First Run — Setup Wizard

Open `http://localhost:3000`

You'll be redirected to the **Setup Wizard** automatically. Follow the 4 steps:

1. **Bot Setup** — Enter your Bot Token (from @BotFather) and Channel ID. Click "Test Connection" to validate.
2. **Admin Account** — Create your admin credentials.
3. **SMTP** _(optional)_ — Configure email for verification flows.
4. **Finalize** — Review and complete setup.

---

## 🔐 Authentication Flow

### Worker Registration
1. Admin creates worker via Workers page → `/workers`
2. If SMTP configured → verification email sent → worker must verify before logging in
3. If SMTP not configured → worker can log in immediately
4. On first login → **Telegram OTP verification** page shown
5. Worker opens bot, sends /start, enters the OTP shown on screen
6. ✅ Dashboard unlocked

### Password Reset
- If SMTP enabled → OTP sent to email
- If SMTP disabled → OTP sent via Telegram bot to worker's linked chat

---

## 🤖 Bot Logic

### Customer Flow
1. Customer sends `/start` to bot
2. If **1 language** → goes straight to support flow
3. If **2+ languages** → language selection keyboard shown
4. If a free worker exists → session created, worker notified
5. Messages relay in real-time between customer ↔ worker
6. **2-minute inactivity** → auto session close

### Session End
When a session closes (manual or timeout):
- PDF transcript generated (text + embedded images)
- Videos forwarded to Telegram channel
- PDF sent to channel with caption: User ID, Worker, Date, Message count

---

## 📁 Project Structure

```
telegram-support/
├── backend/
│   ├── server.js              ← Express app entry point
│   ├── bot/
│   │   └── bot.js             ← grammY bot + session logic
│   ├── routes/
│   │   ├── setup.js           ← Setup wizard API
│   │   ├── auth.js            ← Login, register, OTP, reset
│   │   ├── sessions.js        ← Session CRUD + messaging
│   │   ├── workers.js         ← Worker management
│   │   ├── languages.js       ← Language + bot texts CRUD
│   │   └── settings.js        ← System settings
│   ├── services/
│   │   ├── firebaseService.js ← Firebase Admin helpers
│   │   ├── pdfService.js      ← PDF transcript generator
│   │   └── emailService.js    ← Nodemailer SMTP service
│   └── middleware/
│       └── auth.js            ← JWT middleware
│
└── frontend/
    └── src/
        ├── App.jsx             ← Router with setup/auth gates
        ├── firebase.js         ← Firebase client SDK
        ├── contexts/
        │   └── AuthContext.jsx
        └── pages/
            ├── SetupWizard.jsx   ← 4-step wizard
            ├── Login.jsx         ← Login + forgot + reset
            ├── TelegramVerify.jsx← Worker Telegram linking
            ├── AdminDashboard.jsx← Real-time overview
            ├── WorkerDashboard.jsx← Live chat interface
            ├── Sessions.jsx      ← Session list
            ├── Workers.jsx       ← Worker management
            ├── Languages.jsx     ← Language + bot text editor
            └── Settings.jsx      ← SMTP + general settings
```

---

## ⚙️ Firestore Security Rules (recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for setup status check only
    match /configs/system {
      allow read: if true;
      allow write: if false; // only via backend
    }
    // All other documents — backend only
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🛡️ Environment Variables

### Backend (`backend/.env`)
| Variable                        | Required | Description                      |
|---------------------------------|----------|----------------------------------|
| `PORT`                          | No       | Server port (default: 5000)      |
| `FRONTEND_URL`                  | Yes      | CORS origin for frontend         |
| `JWT_SECRET`                    | Yes      | Secret for JWT signing           |
| `FIREBASE_STORAGE_BUCKET`       | Yes      | Firebase storage bucket          |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No*      | JSON string of service account   |

*If not set, reads from `firebase-service-account.json` file

### Frontend (`frontend/.env`)
All `VITE_FIREBASE_*` variables from your Firebase web app config.
