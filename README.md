# Personal Budget Tracker

Our overall goal is to build a personal finance AI agent that helps you and your wife stay on top of your spending and budgets. Here's a quick recap of the key components and how they fit together:

## Key Features

- **Automated Transaction Fetching:** The agent will periodically connect to Plaid to pull your most recent transactions from your Chase account.
- **AI-Powered Categorization:** It will then use an AI (specifically, a Large Language Model like Gemini) to automatically assign these raw transactions to predefined budget categories (e.g., "Groceries," "Utilities," "Dining Out").
- **Budget Tracking & Insights:** The system will keep track of your spending within each category against your set weekly budget limits, and then display how much you've spent and how much you have left for the week.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** AWS Lambda, AWS Amplify, Firebase
- **Database:** PostgreSQL, Firestore

## Architecture

This project follows a hybrid architecture:

- **Frontend (React App):** This is the UI we've been working on, hosted on AWS Amplify, providing a real-time view of your budget categories and spending. It uses Firebase Firestore for quick, real-time updates of your budget summaries.
- **Backend (AWS Serverless):** This will consist of AWS Lambda functions to handle the Plaid integration and AI categorization. It will store the detailed transaction history in your existing AWS PostgreSQL database.
- **Data Flow:** Plaid transactions -> Lambda (AI Categorization) -> PostgreSQL (detailed history) -> Lambda (summarize spending) -> Firestore (update budget UI).

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/edgewood1/budget-tracker-fe.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Create a `.env.local` file in the root of the project and add your Firebase configuration:
   ```
    VITE_FIREBASE_API_KEY="YOUR_API_KEY"
    VITE_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    VITE_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    VITE_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    VITE_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    VITE_FIREBASE_APP_ID="YOUR_APP_ID"
   ```

## Usage

To run the app in development mode, run the following command:

```sh
yarn dev
```

This will start the app on `http://localhost:5173`.

Our overall goal is to build a personal finance AI agent that helps you and your wife stay on top of your spending and budgets. Here's a quick recap of the key components and how they fit together:

Automated Transaction Fetching: The agent will periodically connect to Plaid (a financial data aggregator) to pull your most recent transactions from your Chase account.

AI-Powered Categorization: It will then use an AI (specifically, a Large Language Model like Gemini) to automatically assign these raw transactions to predefined budget categories (e.g., "Groceries," "Utilities," "Dining Out").

Budget Tracking & Insights: The system will keep track of your spending within each category against your set weekly budget limits, and then display how much you've spent and how much you have left for the week.

Hybrid Architecture:

Frontend (React App): This is the UI we've been working on, hosted on AWS Amplify, providing a real-time view of your budget categories and spending. It uses Firebase Firestore for quick, real-time updates of your budget summaries.

Backend (AWS Serverless): This will consist of AWS Lambda functions to handle the Plaid integration and AI categorization. It will store the detailed transaction history in your existing AWS PostgreSQL database.

Data Flow: Plaid transactions -> Lambda (AI Categorization) -> PostgreSQL (detailed history) -> Lambda (summarize spending) -> Firestore (update budget UI).