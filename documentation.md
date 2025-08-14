# Automated Financial Document Organizer

## Project Overview
This project is an automation tool designed to streamline financial record-keeping. The application acts as a bridge between a user's Gmail, Google Drive, and Google Sheets. It intelligently scans for incoming invoices and receipts, archives them in a structured way, and logs all relevant details in a spreadsheet for easy tracking and reporting.

### Input & Output
- **Input:** Emails with invoices/receipts in Gmail.
- **Process:** Scan emails → Download attachments → Upload to Google Drive → Log in Google Sheets.
- **Output:** Structured files in Drive + logged rows in Sheets.

## End-to-End Flow (Example)
**Scenario:** 12 Aug 2025, email from `Acme Billing <billing@acme.com>` with subject "Invoice #INV-2025-078 for July" and attachment `invoice_078.pdf`.

**Steps:**
1. **Scan Gmail:** Query `has:attachment (invoice OR receipt OR bill) -label:AFDO-Processed newer_than:30d`.
2. **Pick Email:** Identify email matching criteria.
3. **Extract Info:**
   - Sender email: `billing@acme.com`
   - Subject: "Invoice #INV-2025-078 for July"
   - Date: `2025-08-12`
   - Invoice number: `INV-2025-078`
4. **Upload to Drive:** Folder `AFDO/Invoices/2025/08/` with file name `AcmeBilling_INV-2025-078_2025-08-12.pdf`.
5. **Log to Sheets:** Append a row with extracted info and Drive file ID.
6. **Mark Email:** Apply label `AFDO-Processed` to prevent reprocessing.

## System Design (NestJS Modules)
- **AuthModule:** Google OAuth 2.0, token management.
- **GmailModule:** Search, fetch, download attachments, label emails.
- **DriveModule:** Ensure folders, upload files, structured naming.
- **SheetsModule:** Append rows with email & file details.
- **ScanModule:** Orchestrates Gmail, Drive, Sheets, triggered by `/scan` endpoint.
- **TokenStore/UsersModule:** Secure storage for tokens.

## Gmail Scanning
- Queries: `has:attachment (invoice OR receipt OR bill) -label:AFDO-Processed`.
- Avoid reprocessing: label emails and store `gmail_message_id`.
- Handle attachments only (`Content-Disposition: attachment`).

## Drive File Management
- Folder tree: `AFDO/Invoices/YYYY/MM/`.
- Naming: `[SenderName]_[InvoiceNumber]_[EmailDate].pdf`.
- Sanitize filenames: remove special chars, replace spaces with underscores.

## Sheets Logging
- Columns:
  1. `processed_at`
  2. `from_email`
  3. `sender_name`
  4. `subject`
  5. `email_date`
  6. `invoice_number`
  7. `drive_file_name`
  8. `drive_file_id`
  9. `drive_url`
  10. `gmail_message_id`
  11. `status`
  12. `notes`

## Invoice Number Extraction
- Regex examples:
  - `(?i)(invoice|inv|tax\s*invoice)\s*#?\s*([A-Z0-9-]+)`
  - Fallback for orders: `(?i)(order|od)\s*#?\s*([A-Z0-9-]+)`

## OAuth & Tokens
- Scopes: `gmail.readonly`, `gmail.modify`, `drive.file`, `spreadsheets`.
- Store refresh tokens encrypted.
- Redirect URI: local dev & production domain.

## Errors & Edge Cases
- Per-email try/catch.
- Retry for 429/5xx errors.
- Large attachments handled with chunked upload.
- Partial success labeling: `AFDO-Error` if upload/Sheet append fails.

## Config & Environment Variables
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- `AFDO_DRIVE_ROOT_FOLDER_ID`, `AFDO_SHEETS_SPREADSHEET_ID`, `AFDO_SHEETS_TAB_NAME`
- `AFDO_GMAIL_QUERY`, `AFDO_PROCESSED_LABEL`, `AFDO_ERROR_LABEL`
- `LOG_LEVEL`

## Deployment & Demo Plan
1. Setup `.env`, enable APIs, consent screen.
2. Authenticate user → tokens saved.
3. Ensure Drive folder & Sheet headers exist.
4. Trigger `POST /scan`.
5. Validate Drive uploads, Sheet rows, Gmail labels.

## MVP Acceptance Criteria
- Recent emails scanned and processed.
- Attachments uploaded to correct Drive folder.
- Sheet logged correctly with status `SUCCESS`.
- Emails labeled `AFDO-Processed`.
- Re-run skips already processed emails.
- Errors logged with `AFDO-Error` label and notes.

## Stretch Goals
- Gmail push notifications (real-time).  
- Multi-user tenancy.  
- Amount/currency extraction with OCR.  
- Admin dashboard for processed counts and errors.  
- Unit tests with mocked Google APIs.

