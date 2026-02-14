# Personal Finance & Tax Intelligence Platform

## Project Overview
This is a production-ready personal finance assistant that helps users track expenses, manage budgets, optimize taxes, and improve financial health using AI-powered insights.

## Credentials and Configuration
The application uses **Replit Native Integrations** for its core services. This means you do not need to manually configure API keys or secrets in the code.

### 1. Authentication (Replit Auth)
- **Status**: Pre-configured.
- **How it works**: Uses Replit's built-in OIDC provider.
- **Where to manage**: Authentication settings and user access are managed directly via the Replit interface (Tools > Auth).

### 2. Database (PostgreSQL)
- **Status**: Pre-configured.
- **Connection**: Managed via the `DATABASE_URL` environment variable.
- **Where to manage**: You can inspect your database tables and data via the Replit interface (Tools > Database).

### 3. AI Integrations (OpenAI)
- **Status**: Pre-configured.
- **How it works**: Uses Replit AI Integrations for OpenAI access.
- **Environment Variables**: `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` are automatically set by the platform.
- **No API Key Required**: You do not need your own OpenAI API key; usage is billed to your Replit credits.

### 4. Custom Secrets
If you need to add any additional sensitive information (like custom API keys for other services):
1. Open the **Secrets** tab in the Replit sidebar (Lock icon).
2. Add your key-value pairs there.
3. Access them in the backend using `process.env.YOUR_SECRET_NAME`.

## Getting Started
1. Click **Run** to start the application.
2. Navigate to the live URL.
3. Click **Get Started** to log in using Replit Auth.
4. (Optional) Call the `/api/seed` endpoint while logged in to populate the dashboard with sample data for demonstration.

## Technology Stack
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui, Recharts, Framer Motion.
- **Backend**: Node.js, Express.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI**: OpenAI via Replit AI Integrations.
