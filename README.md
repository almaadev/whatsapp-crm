# Almaa Herbal Nature CRM

An enterprise-grade Customer Relationship Management (CRM) platform built specifically for **WhatsApp customer engagement**, **lead pipeline management**, **automated keyword workflows**, **multi-branch sales operations**, and **real-time team collaboration**.

Built for **Almaa Herbal Nature**, this platform streamlines customer communication, automates lead assignment, monitors sales metrics, and enables multi-role collaboration across branches.

---

## 📑 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Directory Structure](#-directory-structure)
- [User Roles & Permissions](#-user-roles--permissions)
- [WhatsApp & Keyword Automation](#-whatsapp--keyword-automation)
- [Environment Configuration](#-environment-configuration)
- [Getting Started](#-getting-started)
- [Database Migrations](#-database-migrations)
- [Security & Encryption](#-security--encryption)
- [Documentation](#-documentation)
- [License](#-license)

---

## ✨ Features

- 💬 **Real-time WhatsApp Communication**: Instant bi-directional messaging using Twilio WhatsApp API & Socket.io synchronization.
- 🤖 **Keyword Automated Responses**: Intelligent lead categorization and auto-replies (MD Camp, Product, Therapy, Direct Leads) using approved templates.
- 📋 **Lead & Pipeline Management**: Track sales funnels, status progressions (`New`, `Contacted`, `Interested`, `Follow-up`, `Closed`, `Lost`), deal sizes, priority levels, and follow-up schedules.
- 👥 **Role-Based Access Control (RBAC)**: Custom NextAuth.js authentication with role-based routing for `Super Admin`, `Sales`, `Doctor`, and `Associate` users.
- 🟢 **User Online Presence**: Live online/offline tracking and socket connection management.
- 📁 **WhatsApp Template Engine**: Search, preview, dynamic variable injection (`{{1}}`, `{{2}}`), and meta template status management.
- 🏢 **Multi-Branch & Regional Phone Support**: Supports branch-specific WhatsApp numbers (e.g., Chennai regional line) and branch filtering.
- 📊 **Analytics & Reporting Dashboards**: Monitor customer volume, message counts, associate performance, conversion rates, and revenue.
- 🔒 **Payload Encryption & Data Protection**: Encryption utilities for sensitive payload transport (`NEXT_PUBLIC_API_ENCRYPTION_KEY`), password hashing via bcryptjs, and Redis token blacklisting.

---

## 🛠️ Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Server-side rendering, API routes, App layout |
| **Frontend Library** | React 19 | UI component architecture |
| **Server Engine** | Custom Node.js Server | `src/server.js` running HTTP server + Socket.io |
| **Database** | MongoDB + Mongoose 9 | NoSQL persistence layer for customer, lead, and message records |
| **Caching & Sessions** | Redis (`ioredis`) | Session store, JWT blacklisting, and fast query caching |
| **Real-time Sync** | Socket.io 4 | WebSockets for live chat, presence, and status notifications |
| **State & Data Fetching**| Zustand 5 + TanStack Query 5 | Client-side state management and asynchronous server state caching |
| **Styling** | Tailwind CSS v4 + Framer Motion | Modern responsive design system and micro-animations |
| **Messaging & Voice** | Twilio API | Twilio WhatsApp Business API & Twilio Voice/TwIML support |
| **Authentication** | NextAuth.js v4 | JWT strategy, credentials provider, protected middleware |

---

## 📐 System Architecture

```
                       Twilio WhatsApp Business API
                                    │
                                    ▼
                      Incoming Webhook / Route Handler
                                    │
                       Keyword Detection & Routing
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
 Automatic Auto-Reply                              Store Message & Lead
  (Template Engine)                                (MongoDB / Mongoose)
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    ▼
                          Socket.io Event Server
                            (`src/server.js`)
                                    │
                                    ▼
                      Next.js CRM Dashboard & Inbox
                   (`src/app` / `src/features/chat`)
```

---

## 📂 Directory Structure

The project follows a modular, feature-driven directory structure inside `src/`:

```
.
├── docs/                             # Deep-dive technical documentation
│   └── technical_documentation.md    # Complete system specification
├── public/                           # Static public assets
├── scripts/                          # Maintenance & DB migration scripts
│   └── migrate.js                    # Database migration tool
├── src/
│   ├── app/                          # Next.js 16 App Router
│   │   ├── api/                      # Next.js API endpoints (webhooks, auth, export)
│   │   ├── crm/                      # Core CRM pages (chat, leads, reports, admin)
│   │   ├── globals.css               # Global styles & Tailwind CSS v4 config
│   │   ├── layout.js                 # Root app layout & providers
│   │   └── page.js                   # Root landing / redirect page
│   ├── features/                     # Feature modules (UI, components, hooks, stores)
│   │   ├── admin/                    # System administration & branch management
│   │   ├── auth/                     # Authentication components & login forms
│   │   ├── branches/                 # Branch location configurations
│   │   ├── chat/                     # WhatsApp live inbox, chat window & media previews
│   │   ├── leads/                    # Lead board, pipeline views & customer profiles
│   │   ├── presence/                 # User online presence tracker
│   │   ├── reports/                  # Analytics, charts & report exports
│   │   ├── templates/                # WhatsApp template library & message composer
│   │   └── user/                     # Associate & user profile tools
│   ├── server/                       # Server-side domain business logic
│   │   └── services/                 # Activity, chat, customer & lead server services
│   ├── shared/                       # Shared utilities, hooks, models & configuration
│   │   ├── api/                      # HTTP client & Axios request wrappers
│   │   ├── components/               # Common UI components (buttons, modals, tables)
│   │   ├── config/                   # System config & environment setups
│   │   ├── constants/                # Enums, statuses & constant values
│   │   ├── hooks/                    # Global custom React hooks
│   │   ├── lib/                      # DB connections (MongoDB, Redis), socket client
│   │   ├── models/                   # Mongoose DB schemas (User, Customer, Lead, etc.)
│   │   ├── repositories/              # Database data access layer
│   │   ├── serializers/              # Data encryption & serialization utilities
│   │   ├── services/                 # Business logic services
│   │   └── utils/                    # Helper functions, date formatters, audio alerts
│   ├── proxy.js                      # Route proxy handler
│   └── server.js                     # Custom Node.js server (Next.js + Socket.io)
├── .env.local                        # Local environment variables
├── next.config.mjs                   # Next.js configuration
├── package.json                      # npm dependencies and scripts
└── README.md                         # Project documentation
```

---

## 👥 User Roles & Permissions

- 👑 **Super Admin**: Full administrative control over all branches, associates, templates, reporting, system settings, and lead reassignments.
- 💼 **Sales Associate**: Access to assigned WhatsApp conversations, lead pipeline updates, follow-up scheduling, customer notes, and template messaging.
- 🩺 **Doctor**: Access to medical consultation leads, patient conversation history, clinical follow-ups, and specialized consultation notes.

---

## 🤖 WhatsApp & Keyword Automation

Incoming WhatsApp messages trigger intelligent keyword detection:

```
Incoming Customer Message
           │
           ▼
 Keyword Router Engine
           │
 ┌─────────┼───────────┬──────────────┐
 ▼         ▼           ▼              ▼
Product MD Camp     Therapy        Direct
 Lead     Lead       Lead           Lead
 └─────────┴───────────┴──────────────┘
           │
           ▼
 Send Approved WhatsApp Template Auto-Reply
```

Automations allow instantaneous engagement with prospective leads before an associate manually takes over the conversation.

---

## 🔑 Environment Configuration

Create a `.env.local` file in the project root with the required environment parameters:

```env
# Node & Server Setup
PORT=3000
HOST="localhost"
NODE_ENV="development"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# Authentication (NextAuth.js)
NEXTAUTH_SECRET="your-nextauth-secret-key"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="your-jwt-secret-key"

# Database Connections
MONGODB_URI="mongodb://127.0.0.1:27017/almaa_crm"
MONGODB_DB="almaa_crm"
REDIS_URL="redis://127.0.0.1:6379"

# Security & Encryption
NEXT_PUBLIC_API_ENCRYPTION_KEY="your-32-byte-hex-encryption-key"

# Twilio Account & WhatsApp Credentials
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_API_KEY="your_twilio_api_key"
TWILIO_API_SECRET="your_twilio_api_secret"
TWILIO_TWIML_APP_SID="your_twiml_app_sid"
NEXT_PUBLIC_TWILIO_PHONE_NUMBER="whatsapp:+91XXXXXXXXXX"
NEXT_PUBLIC_TWILIO_WHATSAPP_NUMBER_CHENNAI="whatsapp:+91XXXXXXXXXX"

# Initial Admin Credentials
ADMIN_EMAIL="admin@almaa.com"
ADMIN_PASSWORD="admin123"
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your environment:
- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0 or higher (running locally or MongoDB Atlas)
- **Redis**: v6.0 or higher (running locally or cloud instance)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/whatsapp-crm.git
   cd whatsapp-crm
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` (or set up `.env.local`) with your local MongoDB, Redis, NextAuth, and Twilio credentials.

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   > The app will launch on `http://localhost:3000` via the custom Node.js server (`src/server.js`).

5. **Build and Run in Production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🔄 Database Migrations

To run database maintenance or update database collections, execute the migration script:

```bash
node scripts/migrate.js
```

The script automatically detects environment configurations from `.env` / `.env.local` and executes schema transformations safely.

---

## 🔒 Security & Encryption

- **Authentication**: Powered by NextAuth.js using secure JWT tokens and bcrypt password hashing.
- **Token Blacklisting**: Revoked sessions are logged in Redis to prevent unauthorized session reuse.
- **Payload Encryption**: Endpoints support request/response payload encryption using AES via `NEXT_PUBLIC_API_ENCRYPTION_KEY`.
- **Role Guards**: Middleware routes and feature components are guarded by role-based authorization helpers (`src/shared/utils/auth.js`).

---

## 📖 Documentation

For detailed technical specifications, database schema diagrams, API contracts, and real-time Socket event schemas, consult the dedicated documentation:

👉 **[Technical Documentation](file:///d:/HARD%20DISK%20FILES/whatsapp-crm%20-%20test/docs/technical_documentation.md)**

---

## ⚖️ License

Proprietary software developed for **Almaa Herbal Nature**.  
All rights reserved. Unauthorized copying, distribution, or commercial reuse is strictly prohibited.
