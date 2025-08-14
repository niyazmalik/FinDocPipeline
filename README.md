# FinOrganizer

## Overview

**FinOrganizer** is a NestJS-based automation tool designed to streamline financial record-keeping. It scans your Gmail for invoices and receipts, archives them in Google Drive with a structured naming system, and logs all relevant details in Google Sheets for easy tracking and reporting.

## Features

- Scan Gmail inbox for invoices, receipts, and bills.
- Download attachments and upload to Google Drive.
- Log extracted email information (sender, subject, date, invoice number) in Google Sheets.
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
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
TOKEN_ENCRYPTION_KEY=some_secure_key
AFDO_DRIVE_ROOT_FOLDER_ID=your_drive_folder_id
AFDO_SHEETS_SPREADSHEET_ID=your_sheet_id
AFDO_SHEETS_TAB_NAME=Logs
AFDO_GMAIL_QUERY=has:attachment (invoice OR receipt OR bill) -label:AFDO-Processed newer_than:30d
AFDO_PROCESSED_LABEL=AFDO-Processed
AFDO_ERROR_LABEL=AFDO-Error
LOG_LEVEL=debug
```

### Running the Application

```bash
# Start the development server
npm run start:dev
```

- Authenticate your Google account via the OAuth flow.
- Ensure the Drive folder and Google Sheet tab exist.
- Trigger the scan via the API endpoint `POST /scan`.

## Usage

- The service will scan your Gmail for relevant emails.
- Attachments are uploaded to Drive following a structured naming convention.
- Email details are logged in Google Sheets.
- Processed emails are labeled to prevent re-processing.

## Folder Structure

```
src/
  app.controller.ts
  app.module.ts
  main.ts
  modules/
    auth/
    gmail/
    drive/
    sheets/
    scan/
```


