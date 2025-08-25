# FinDocPipeline

## Overview

**FinDocPipeline** is a backend service built with NestJS, PostgreSQL, and Google APIs to automate financial email and document processing.
It fetches emails from Gmail, classifies them using Gemini AI, organizes attachments in Google Drive, logs records in Google Sheets, and stores structured data in a relational database.

## Features

- Scan Gmail inbox for invoices, receipts, and bills.  
- Download attachments and upload them securely to Google Drive.  
- Log extracted email information (sender, subject, date, invoice number) in Google Sheets.  
- Classify emails (financial / non-financial) using **Google Gemini AI** with confidence score.  
- Batch classification for efficient AI calls.  
- Apply labels to processed emails to avoid duplication.  
- Secure OAuth 2.0 authentication with token refresh support.  

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or yarn
- Google Cloud project with Gmail, Drive, and Sheets APIs enabled
- OAuth 2.0 credentials for a web application

### Installation

```bash
# Install NestJS CLI globally if not already installed
npm i -g @nestjs/cli

# Initialize project in current folder
nest new .

# Install required Google API client libraries
npm install googleapis dotenv
```

### Environment Variables

Create a `.env` file in the root directory with the following:

```
# --- Server Config ---
PORT=3000
NODE_ENV=development

# --- Database Config ---
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=your-db-username
DB_PASS=your-db-password
DB_NAME=your-db-name

# --- Google OAuth ---
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# --- Gemini API ---
GEMINI_API_KEY=your-gemini-api-key

# --- Security ---
TOKEN_ENCRYPTION_KEY=your-32-char-secret-key

# --- Google Drive ---
DRIVE_FOLDER_ID=your-google-drive-folder-id

# --- Google Sheets ---
SHEET_SPREADSHEET_ID=your-google-sheet-id

```

### Running the Application

```bash
# Start the development server
npm run start:dev
```

- Authenticate your Google account via the OAuth flow.
- Ensure the Drive folder and Google Sheet tab exist.
- Trigger the scan via the API endpoint `GET /scan?userId=user_id`.

## Folder Structure

```
src/
  app.module.ts
  main.ts
  common
  entities
  scan
  modules/
    auth/
    gmail/
    drive/
    sheets/
    gemini/

```


