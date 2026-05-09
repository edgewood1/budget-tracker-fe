# Personal Budget Tracker

A personal finance AI agent that helps track spending and budgets by automatically fetching, categorizing, and summarizing transactions.

## Features

- **Automated Transaction Fetching:** Connects to Plaid to pull recent transactions from linked bank accounts
- **AI-Powered Categorization:** Uses Gemini LLM to assign transactions to predefined budget categories (Groceries, Utilities, Dining Out, etc.)
- **Real-time Budget Tracking:** Displays weekly spending per category against set budget limits

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** AWS Lambda, AWS Amplify, Firebase
- **Database:** PostgreSQL, Firestore

## Architecture

- **Frontend (React App):** Hosted on AWS Amplify, provides real-time budget views via Firebase Firestore
- **Backend (AWS Serverless):** Lambda functions handle Plaid integration and AI categorization, storing detailed transaction history in PostgreSQL
- **Data Flow:** Plaid → Lambda (AI Categorization) → PostgreSQL → Lambda (summarize) → Firestore → UI

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- yarn

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/edgewood1/budget-tracker-fe.git
   ```
2. Install dependencies
   ```sh
   yarn
   ```
3. Create a `.env.local` file and add your Firebase configuration:
   ```
   VITE_FIREBASE_API_KEY="YOUR_API_KEY"
   VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
   VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
   VITE_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
   VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
   VITE_FIREBASE_APP_ID="YOUR_APP_ID"
   ```

## Usage

```sh
yarn dev
```

Starts the app at `http://localhost:5173`.
