# 🛒 Backend Product Requirement Document (PRD)

**Project:** E-Commerce Platform (Backend)  
**Stack:** Node.js + Express.js + MongoDB + Mongoose  

## 🤝 Overview

Backend services for a complete E-Commerce Platform supporting three roles:

- **User (Customer)**
- **Seller**
- **Admin (Super Admin + Sub Admins)**

**Architecture:**  
Modular, role-based access, token-authenticated API system using JWT, OTP-based onboarding.

---

## 🌐 System Modules

### 1. Authentication Module

- JWT Token Based Auth
- OTP via Mobile/Email (Twilio/SendGrid)
- Role-based Middleware for Access Control

**Routes:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`

---

### 2. User Module

- User Profile
- Multiple Addresses
- Order History (1M, 3M, 1Y filtering)
- Bank Details
- Help Center (complaints, tracking issues)
- Offers and Coupons
- Return/Exchange Handling (with video upload)

**Routes:**
- `CRUD /api/user/profile`
- `CRUD /api/user/addresses`
- `GET /api/user/orders?duration=1m|3m|1y`
- `GET /api/user/order/:id`
- `POST /api/user/order/return`
- `POST /api/user/order/exchange`
- `POST /api/user/bank-details`
- `GET /api/user/offers`
- `POST /api/user/help`

---

### 3. Seller Module

- Seller Profile with KYC & Location
- Company Details, PAN, GST, Cancel Cheque Uploads
- Seller Onboarding Validation Flow
- Order Management (Accept → Label → Dispatch)
- RTO/RVP Complaint System (with video)
- Pricing & Inventory Management
- Category Management
- Claims System
- Sponsored Listings (Keywords)
- Influencer Marketing
- Seller Reports (PDF/CSV)

**Routes:**
- `POST /api/seller/register`
- `POST /api/seller/onboarding`
- `GET /api/seller/orders`
- `POST /api/seller/order/:id/action`
- `POST /api/seller/return/complaint`
- `POST /api/seller/product`
- `PATCH /api/seller/product/:id`
- `DELETE /api/seller/product/:id`
- `POST /api/seller/claims`
- `GET /api/seller/payments`
- `GET /api/seller/reports`
- `POST /api/seller/influencer`
- `POST /api/seller/sponsored`

---

### 4. Admin Module

#### Super Admin
- Full Access: All Roles, All Data
- Role Management
- View & Override: Tickets, CMS, Orders
- Feature Flags, SLA Handling, Audit Logs

**Routes:**
- `GET /api/admin/dashboard`
- `CRUD /api/admin/users`
- `CRUD /api/admin/sellers`
- `CRUD /api/admin/orders`
- `CRUD /api/admin/cms`
- `CRUD /api/admin/roles`
- `GET /api/admin/logs`
- `PATCH /api/admin/override`

#### Sub-Admins by Role

- **catalog_admin**  
  - Approve/Reject Products  
  - Resolve KYC  
  - `PATCH /api/catalog/product/:id/approve`  
  - `PATCH /api/catalog/kyc/:id`

- **cms_admin**  
  - Manage Pages, Banners, Email Templates  
  - `POST /api/cms/home`  
  - `POST /api/cms/email-template`

- **support_admin**  
  - Ticket Resolution, Chat, Escalation  
  - `GET /api/support/tickets`  
  - `PATCH /api/support/ticket/:id`  
  - `POST /api/support/chat`

- **finance_admin**  
  - Settlements, Payment Exceptions  
  - `POST /api/finance/settlement`  
  - `GET /api/finance/payments`  
  - `GET /api/finance/reports`

- **data_analyst**  
  - Access Analytics Hub (read-only)  
  - `GET /api/analytics/*`

---

## 📂 MongoDB Collections

- `users`
- `sellers`
- `admins`
- `products`
- `categories`
- `orders`
- `returns`
- `tickets`
- `offers`
- `videos`
- `claims`
- `sponsored`
- `influencer_links`
- `settlements`
- `cms`
- `logs`

---

## 🔊 Notification System

- Event-driven (Email, SMS, In-App)
- **Triggers:**
  - New Order
  - Complaint Update
  - Settlement Approved
  - SLA Breaches

- Store notification logs in DB

---

## ⚡ Core Middlewares

- Auth Middleware (JWT)
- Role Check Middleware
- OTP Validator
- Video Upload Handler
- Error Handler

---

## 🚀 Third Party Integrations

- **Twilio / MSG91:** SMS OTP  
- **SendGrid / SMTP:** Email OTP & Notifications  
- **Razorpay / Stripe:** Payments  
- **AWS S3:** File/Video Storage  
- **GST Verification API:** Govt KYC  
- **Google Geolocation:** Seller Location

---

## 🔄 Background Jobs (CRON)

- Auto soft-delete order history after 3 months
- Auto-penalty if seller doesn’t act on video in 9 hours
- Auto-settlement triggers

---

This backend PRD ensures business logic, security, workflows, and module isolation are structured for a MERN-based system.
