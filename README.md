#  Almaa Herbal Nature CRM

A modern, enterprise-grade Customer Relationship Management (CRM) platform built specifically for **WhatsApp-based customer engagement**, **lead management**, **sales operations**, and **real-time team collaboration**.

The platform enables organizations to manage customer conversations, automate WhatsApp communication, assign leads, monitor sales performance, and collaborate across multiple departments through a scalable architecture.

---

# Features

- 🔐 Secure Authentication & Authorization
- 💬 Real-time WhatsApp Chat
- 📲 Twilio WhatsApp Integration
- 🤖 Keyword-based Automated Replies
- 📋 Lead & Customer Management
- 👥 Multi-Role User Management
- 🏢 Branch & Associate Support
- 📊 Dashboard & Reports
- 📁 WhatsApp Template Management
- 🔄 Live Socket.io Synchronization
- ⚡ Redis Caching & Session Management
- 📎 Media Message Support
- 🎯 Follow-up Tracking
- 🔍 Global Customer Search

---

# Tech Stack

| Category | Technology |
|-----------|------------|
| Framework | Next.js (App Router) |
| Runtime | Node.js Custom Server |
| Database | MongoDB + Mongoose |
| Cache | Redis (ioredis) |
| Authentication | NextAuth.js |
| Password Hashing | bcryptjs |
| Real-time | Socket.io |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |
| Messaging | Twilio WhatsApp API |
| Language | JavaScript |

---

# System Architecture

```
                Twilio WhatsApp
                       │
                       ▼
                Webhook Endpoint
                       │
          Keyword Detection & Routing
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
 Automatic Reply               Store Message
 (Template Engine)             MongoDB
        │                             │
        └──────────────┬──────────────┘
                       ▼
                Socket.io Events
                       │
                       ▼
              Next.js CRM Dashboard
```

---

# Authentication & Access Control

The CRM uses **NextAuth.js** with a custom **Credentials Provider**.

Supported roles:

- Super Admin
- Sales
- Doctor

Features include:

- JWT Authentication
- Secure Password Hashing
- Redis Token Blacklisting
- Protected Middleware Routes
- Module-based Permissions
- Department-based Access
- Session Validation

Protected modules include:

- Dashboard
- CRM Inbox
- Reports
- Bulk Messaging
- Template Library
- Associate Management
- Admin Panel

---

# WhatsApp Integration

The CRM integrates directly with the **Twilio WhatsApp Business API**.

Capabilities include:

- Receive Incoming Messages
- Send Individual Messages
- Send Template Messages
- Manage WhatsApp Templates
- Delivery Status Tracking
- Read Receipts
- Media Messages
- Webhook Processing
- Real-time Synchronization

Supported media:

- Images
- Videos
- Audio
- Documents
- PDF Files

---

# Intelligent Message Routing

Incoming WhatsApp messages are automatically categorized using keyword matching.

Example routing:

```
Incoming Message
        │
        ▼
Keyword Detection
        │
 ┌──────┼─────────┐
 ▼      ▼         ▼
Product MD Camp Therapy
 Lead     Lead     Lead
        │
        ▼
 Default Direct Lead
```

Automation supports:

- Product Leads
- Medical Camp Leads
- Therapy Leads
- Direct Leads

If an active keyword automation exists, the system automatically replies using an approved WhatsApp Template.

---

# Customer Management

Features include:

- Customer Profiles
- Conversation History
- Lead Assignment
- Associate Ownership
- Branch Assignment
- Notes & Remarks
- Follow-up History
- Lead Status
- Priority Levels
- Customer Search

---

# Lead Management

Each lead contains:

- Customer Details
- Status
- Priority
- Source
- Follow-up Schedule
- Sales Amount
- Assigned Associate
- Branch
- Closing Information
- Remarks

Supported statuses:

- New
- Contacted
- Interested
- Follow-up
- Closed
- Lost

---

# Real-Time Communication

Socket.io keeps every connected CRM user synchronized.

Real-time updates include:

- New Messages
- Message Status
- Customer Assignment
- Template Updates
- Chat Notifications
- Lead Changes
- Delivery Reports
- Read Receipts

No manual refresh required.

---

# WhatsApp Templates

Agents can:

- Browse Templates
- Search Templates
- Send Approved Templates
- Fill Dynamic Variables
- Preview Templates
- Categorize Templates
- Manage Template Status

Variable support:

```
Hello {{1}}

Your appointment is confirmed for {{2}}.

Thank you.
```

---

# Dashboard

Dashboard statistics include:

- Total Customers
- Active Leads
- Closed Leads
- Today's Messages
- Revenue
- Follow-ups
- Pending Tasks
- Associate Performance
- Branch Performance

---

# User Roles

## Super Admin

- Full CRM Access
- Manage Users
- Manage Associates
- Manage Branches
- Reports
- Dashboard
- Templates
- Bulk Messaging
- Settings

---

## Sales

- Assigned Customers
- WhatsApp Inbox
- Lead Management
- Follow-ups
- Customer Notes
- Templates

---

## Doctor

- Assigned Patients
- Chat Access
- Medical Follow-ups
- Consultation History

---

# Project Structure

```
.
├── app/
├── components/
├── hooks/
├── lib/
├── middleware/
├── models/
├── repositories/
├── routes/
├── server/
├── services/
├── socket/
├── stores/
├── styles/
├── utils/
├── validators/
├── public/
├── server.js
├── package.json
└── README.md
```

---

# Directory Overview

## `server.js`

Custom Node.js server responsible for:

- Initializing Next.js
- Creating HTTP Server
- Attaching Socket.io
- Starting Application

---

## `app/`

Next.js App Router pages.

Contains:

- Dashboard
- CRM
- Authentication
- Settings
- Reports

---

## `components/`

Reusable React components.

Examples:

- Chat Area
- Sidebar
- Header
- Customer Card
- Lead Card
- Template Modal
- Dashboard Widgets

---

## `services/`

Business logic layer.

Examples:

- Lead Service
- Customer Service
- Twilio Service
- Webhook Service
- Template Service

---

## `repositories/`

Database abstraction layer.

Handles:

- CRUD Operations
- Aggregations
- Pagination
- Search Queries

---

## `models/`

MongoDB Mongoose Models.

Examples:

- User
- Customer
- Lead
- Message
- Template
- KeywordAutomation
- Branch

---

## `stores/`

Zustand state management.

Examples:

- Chat Store
- Category Store
- Template Store
- UI Store

---

## `lib/`

Core configurations.

Includes:

- MongoDB
- Redis
- Authentication
- Socket Configuration
- Keyword Matching

---

## `utils/`

Utility functions.

Examples:

- Date Formatting
- Audio Notifications
- XML Builders
- Helpers
- Constants

---

## `validators/`

Input validation.

Examples:

- Webhook Validation
- Customer Validation
- Lead Validation
- Template Validation

---

# Redis Usage

Redis is used for:

- JWT Blacklisting
- Query Cache
- Session Storage
- Frequently Accessed Data
- Performance Optimization

---

# Security

Security measures include:

- JWT Authentication
- Password Hashing
- Protected Routes
- Middleware Validation
- Redis Session Revocation
- Input Validation
- Environment Variables
- Secure Cookies

---

# Performance

Optimizations include:

- Redis Cache
- Zustand Client Cache
- Socket Event Deduplication
- MongoDB Aggregation Pipelines
- Lazy Component Loading
- Optimized React Rendering

---

# Installation

```bash
git clone https://github.com/yourusername/almaa-herbal-crm.git

cd almaa-herbal-crm

npm install
```

---

# Environment Variables

Create a `.env` file.

```env
NEXTAUTH_SECRET=

NEXTAUTH_URL=

MONGODB_URI=

REDIS_URL=

TWILIO_ACCOUNT_SID=

TWILIO_AUTH_TOKEN=

TWILIO_WHATSAPP_NUMBER=

TWILIO_CONTENT_API_KEY=

JWT_SECRET=
```

---

# Run Development Server

```bash
npm run dev
```

---

# Production

```bash
npm run build

npm start
```

---

# Future Roadmap

- AI Chat Assistant
- AI Lead Scoring
- WhatsApp Broadcast Analytics
- Branch-wise CRM
- Voice Calling Integration
- Call Recording
- Customer Timeline
- Marketing Campaign Automation
- Mobile Application
- Advanced Reporting Dashboard
- Multi-language Support
- Workflow Automation Builder

---

# License

This project is proprietary software developed for **Almaa Herbal Nature**.

Unauthorized copying, modification, distribution, or commercial use is prohibited without written permission.

---

# Developed With ❤️

Built using **Next.js**, **MongoDB**, **Redis**, **Socket.io**, **Twilio**, and modern JavaScript technologies to deliver a scalable, real-time CRM experience for WhatsApp customer engagement.
