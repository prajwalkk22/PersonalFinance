
# Personal Finance Intelligence Platform

A full-stack, AI-powered personal finance management system that helps users **track expenses, manage budgets, plan goals, and optimize tax savings** through intelligent automation and real-time analytics.

---

## 📌 Project Overview

Managing personal finances is often fragmented across apps, spreadsheets, and bank statements. This project consolidates everything into **one intelligent platform** that answers:

- Where is my money going?
- Am I financially healthy?
- Which expenses can reduce my tax?
- How close am I to my financial goals?

The system combines **real-time analytics**, **AI-based categorization**, and **tax intelligence** to provide meaningful insights instead of raw numbers.

---

## ✨ Core Features

### 1. Authentication & User Management
- Secure signup and login
- Session-based authentication
- User-isolated data access
- Persistent login using cookies

---

### 2. Transaction Management
- Add income and expenses
- Supports category, date, payment mode
- Recurring and tax-deductible flags
- AI auto-categorization using transaction description
- Real-time updates across the app

---

### 3. Dashboard Analytics
- Total income, total expenses, and savings
- Financial health score
- Recent transactions
- Category-wise expense breakdown (charts)
- Automatically recalculates on every data change

---

### 4. Budget Tracking
- Create monthly budgets per category
- Track usage vs limit
- Instant updates when transactions are added or deleted

---

### 5. Goals & Savings
- Create financial goals (e.g., car, house, travel)
- Track current progress
- Deadline support
- Goal progress updates automatically with income

---

### 6. Tax Intelligence (AI-Driven)
- Detect tax-deductible transactions
- Classify deductions by tax sections (e.g., 80C, 80D)
- Calculate deductible amount
- Estimate potential tax savings
- Simple visual breakdown for easy understanding

---

## 🤖 AI Capabilities

The platform uses AI to:
- Understand transaction descriptions
- Predict expense category
- Detect tax eligibility
- Suggest tax deduction sections

**Example AI use case:**
> “Medical insurance payment” → Healthcare → Tax deductible → Section 80D

The AI logic is integrated directly into the transaction flow.

---

## 🏗️ System Architecture

```

Frontend (React + TypeScript)
|
| REST APIs
↓
Backend (Node.js + Express)
|
| Database Queries
↓
MongoDB Atlas
|
| AI Requests
↓
Gemini AI API

```

---

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- Recharts
- React Hook Form + Zod

### Backend
- Node.js
- Express
- TypeScript
- REST API architecture
- Session-based authentication

### Database
- MongoDB Atlas

### AI
- Google Gemini API

---

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```

PORT=5000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=personalfinance
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=production

```

> ⚠️ Do not commit `.env` to GitHub.

---

## ▶️ Running the Project Locally

```

npm install
npm run build
npm start

```

The application runs on:
```

[http://localhost:5000](http://localhost:5000)

```

---

## 📊 Data Flow Example

1. User adds a transaction
2. AI categorizes it automatically
3. Transaction is stored in MongoDB
4. Dashboard recalculates:
   - Income / Expense
   - Savings
   - Category charts
   - Tax deductions
5. UI updates instantly without refresh

---

## 🚀 Current Status

- Production-ready build
- Fully functional authentication
- AI-powered categorization
- Real-time analytics
- Budget, goals, and tax intelligence working

---


