# Technical Documentation

## 1. Project Overview

### Purpose of the Project
This project is a comprehensive WhatsApp Customer Relationship Management (CRM) system built on Next.js. It facilitates managing leads, customer communications via WhatsApp, team rosters, and automated marketing flows.

### Key Features
- **Real-Time WhatsApp Messaging:** Send and receive messages instantly via Twilio integration, powered by WebSockets.
- **Lead & Pipeline Management:** Track leads across multiple stages (New, Follow Up, Closed) with dedicated tracking for specific departments (e.g., Product Lead, MD Camp, Therapy).
- **Automations:** Keyword-based auto-replies and template message dispatching.
- **Bulk Messaging:** Run broadcast campaigns using Twilio Templates.
- **Roster & Performance:** Track sales associates' targets, achieved goals, and overall conversion metrics.

### Technology Stack
- **Framework:** Next.js (App Router)
- **Frontend UI:** React, Tailwind CSS
- **Backend Runtime:** Node.js (Next.js API Routes)
- **Database:** MongoDB (via Mongoose)
- **Cache & Pub/Sub:** Redis
- **Real-Time Engine:** Socket.io
- **Authentication:** NextAuth.js (Credentials & JWT)
- **External Providers:** Twilio (WhatsApp API)

---

## 2. System Architecture

### Data Flow & Application Flow
1. **Inbound Webhook (Twilio):** Twilio sends POST requests to `/api/webhook`. The system parses the request, determines the chat routing logic, saves it to MongoDB, and publishes an event to Redis/Socket.io.
2. **Real-Time Updates:** Socket.io emits events to connected clients, updating the UI instantly without page reloads.
3. **Outbound Messaging:** Agents send messages from the frontend. API Routes intercept this, pass it through the validation and service layer, invoke Twilio's API, and persist the record in MongoDB.
4. **Caching:** Redis caches expensive queries (e.g., `chats:all_data` and `users:all`) to reduce DB load. Invalidations occur whenever state mutates.

---

## 3. Folder Structure

- `/docs`: Project documentation.
- `/src/app`: Contains Next.js App Router definitions.
  - `/src/app/api`: All backend API routes (Thin Controllers).
  - `/src/app/crm`: Protected CRM dashboard UI.
- `/src/components`: Reusable React components (UI and Feature-specific).
- `/src/hooks`: Custom React hooks (e.g., `useChat`, `useCategoryChat`).
- `/src/lib`: Core backend infrastructure.
  - `/src/lib/auth.js`: NextAuth configuration.
  - `/src/lib/db`: Connections for MongoDB and Redis.
  - `/src/lib/repositories`: Database abstraction layer (Repository Pattern).
  - `/src/lib/services`: Business logic layer (Service Layer).
  - `/src/lib/validators`: Request data validation schemas.
- `/src/models`: Mongoose schemas.
- `/src/services`: Frontend API wrappers for interacting with the backend.
- `/src/stores`: Frontend state management (Zustand).
- `/src/utils`: Shared utilities (date formatting, phone normalizers).

---

## 4. Architecture Principles

The project strictly follows a **Modular Clean Architecture**:
- **Separation of Concerns (SoC) & Single Responsibility Principle (SRP):** Each module handles one specific task. 
- **Thin Controllers (API Layer):** `route.js` files are responsible *only* for parsing HTTP requests, checking authentication, validating inputs via validators, delegating to the Service Layer, and returning HTTP responses.
- **Service Layer (`src/lib/services`):** Contains all business logic (e.g., Twilio integration, routing rules, complex aggregations).
- **Repository Pattern (`src/lib/repositories`):** Abstracts MongoDB queries. Services never use `Model.find()` directly; they call repository functions like `findAllCustomers()`.

---

## 5. Frontend Documentation

### Architecture
- **State Management:** Uses Zustand (`chatStore`, `categoryChatStore`, `templateStore`) for global state and Context API where applicable.
- **Hooks:** Custom hooks encapsulate logic. `useChat` manages generic inbox connections, while `useCategoryChat` handles specialized department inboxes.
- **UI Architecture:** Built with components grouped by features (`src/components/features`). Layouts (`CrmShell`) persist across page navigations.

---

## 6. Backend Documentation

### Layers
1. **Validators (`src/lib/validators/`):** Ensure data integrity before business logic executes (e.g., `leadValidator`, `chatValidator`).
2. **Services (`src/lib/services/`):** 
   - `chatRoutingService`: Decides where an incoming WhatsApp message belongs.
   - `webhookService`: Handles Twilio payloads.
   - `twilioService`: Abstraction over Twilio Node SDK.
   - `socketEmitter`: Broadcasts Socket.io events.
3. **Repositories (`src/lib/repositories/`):** 
   - Exposes clean CRUD operations like `updateCustomer`, `createMessage`, `findLeadById`.

---

## 7. API Documentation (Key Endpoints)

- **`POST /api/webhook`**: Receives messages from Twilio. No Auth required.
- **`GET /api/chats`**: Retrieves all conversations. Auth: Required.
- **`POST /api/chats`**: Sends a new outbound message. Auth: Required.
- **`POST /api/leads`**: Creates a new lead. Auth: Required.
- **`GET /api/admin/roster`**: Fetches user performance metrics. Auth: SuperAdmin / Admin only.

---

## 8. Database Documentation

### Key Collections
- **Users:** System administrators, associates, and doctors.
- **Customers:** End-users communicating via WhatsApp. Tracks `isOptedOut`, `activeRouteCategory`.
- **Leads:** Contains lifecycle history (`status`, `date`, `associateId`). Linked to `Customers`.
- **Messages:** Universal inbox logging.
- **ProductMessages / MDCampMessages:** Segmented collections for specific conversation types.
- **Templates:** Stores Twilio WhatsApp templates.
- **KeywordAutomations:** Stores mapping of keywords (e.g., "START") to automated `templateSid` responses.

---

## 9. Business Logic

### Webhook Workflow
1. Twilio sends a payload to the webhook.
2. The phone number is normalized.
3. If the message is "STOP" or "START", the opt-out status is updated immediately and Twilio replies directly.
4. If not a command, `chatRoutingService` determines if this is a "Product Lead", "MD Camp", or "Direct Lead".
5. The message is persisted via `messageRepository`.
6. `keywordMatcher` checks if the message triggers an automated template.
7. `socketEmitter` pushes the new message to connected UI clients.

---

## 10. External Integrations

- **Twilio (WhatsApp Business API):** 
  - Used for sending/receiving WhatsApp messages. 
  - Required Environment Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_TWILIO_PHONE_NUMBER`.
- **MongoDB:** Primary data store (Mongoose).
- **Redis:** Caching and Socket.io adapter.

---

## 11. Authentication & Authorization

- Uses **NextAuth.js** with Credentials Provider (JWT strategy).
- Passwords hashed via `bcryptjs`.
- **Roles:** `superAdmin`, `sales`, `doctor`.
- **Departments:** Access is heavily segmented by department (`admin`, `sales`, etc.). API routes explicitly check session roles via `isAuthorized` helpers.

---

## 12. Development Standards

- **Coding Conventions:** Early returns, async/await, strictly named exports.
- **Naming Conventions:** `camelCase` for files/variables. Repositories end in `Repository.js`, services in `Service.js`.
- **Error Handling:** Services throw standard JavaScript `Error` objects, which controllers catch and format into JSON responses with appropriate HTTP status codes (400, 401, 403, 500).
- **Validation:** Always validate request bodies before processing.

---

## 13. Deployment

- **Environment Variables Required:**
  - `MONGO_URI`, `REDIS_URL`
  - `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_TWILIO_PHONE_NUMBER`
  - `NEXT_PUBLIC_SOCKET_URL`
- **Build Process:** Standard Next.js build (`npm run build`).

---

## 14. Future Improvements

1. **Security:** Implement rate-limiting on public API routes (like Webhooks and Auth).
2. **Performance:** Shift Twilio Webhook processing to a background worker/queue (e.g., BullMQ) to ensure immediate 200 OK responses to Twilio and prevent timeouts during heavy load.
3. **Scalability:** Move Socket.io to a dedicated microservice or use Redis Pub/Sub adapter to allow horizontal scaling of the Next.js API servers.
4. **Codebase:** Migrate remaining large monolithic API routes into the thin-controller architecture (Phase 5). Migrate to TypeScript for better type safety.
