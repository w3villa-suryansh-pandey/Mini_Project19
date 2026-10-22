# S19 Release Notes

## Version 1.0.0

S19 is a browser-based workspace for working with PDFs, documents, presentations, and images. This release includes user and admin workspaces, account access controls, and subscription-based access to PDF editing.

### Workspace and interface

- Responsive landing page with product information, feature summaries, and plan details.
- User workspace navigation, dashboard, profile and settings, and light/dark theme support.
- Separate admin area for managing users, plans, reports, and scheduled subscription jobs.

### Account access

- Email and password registration with email verification and resend-verification support.
- Google and Facebook sign-in options.
- Role-protected user and administrator routes.

### Document and media tools

- PDF Editor: view and edit PDFs, including text replacement and redaction, annotations, images, page rotation, reordering, deletion, version history, and download. Scanned-page OCR is available for review and correction.
- Document Editor: edit documents and work with document files in the workspace.
- Writing Pad: compose and format text, insert images, and draw a signature.
- Presentation Studio: create or import slide decks, edit text and formatting, reposition text boxes, manage slides, and export presentations.
- Image Tools: prepare passport photos and remove image backgrounds.
- File Converter: convert supported file formats.
- File Compressor: reduce file sizes for supported files.

### Plans and administration

- User pricing page and Razorpay checkout for one-time day and monthly passes.
- Payment confirmation and subscription access based on captured payment status.
- Admin plan catalog with draft, update, delete, and archive behavior for plans with purchase history.
- Scheduled subscription expiry management, including status, pause/enable, and manual run controls.
- User search and filtering, account detail views, and admin reports.

### Technical notes

- Frontend built with React and Vite; API built with Node.js and Express.
- MongoDB stores account, plan, payment, and related application data.
- PDF editing operations run through a server-side PyMuPDF worker; PDF rendering and scanned-page OCR use browser-side PDF.js and Tesseract.js.
- Google Maps address suggestions require a configured Maps API key. Apryse WebViewer features require a valid license key.

### Libraries behind the features

**Frontend**

- `react` and `react-dom` — build and render the app interface.
- `react-router-dom` — page routing and navigation.
- `@pdftron/webviewer` (Apryse WebViewer) — embedded document/PDF viewing and editing in the document editor; requires a license key.
- `pdfjs-dist` (PDF.js) — render PDF pages and read PDF content in the PDF editor and file converter.
- `pdf-lib` — generate and modify PDF documents, including admin report PDFs.
- `docx-preview` — render DOCX documents for document conversion.
- `html2pdf.js` — export rendered document content to PDF.
- `jszip` — read and write zipped presentation files such as PowerPoint decks.
- `tesseract.js` — perform OCR on scanned page images in the browser.
- `@vis.gl/react-google-maps` — Google Maps components for address assistance; requires a Maps API key.

**Backend**

- `express` — HTTP API and middleware.
- `mongoose` and `mongodb` — model and connect to MongoDB data.
- `bcryptjs` and `jsonwebtoken` — password hashing and signed authentication tokens.
- `passport`, `passport-google-oauth20`, and `passport-facebook` — Google and Facebook OAuth sign-in.
- `nodemailer` — send account verification email; requires SMTP configuration.
- `razorpay` — create payment orders and verify payment data; requires Razorpay credentials.
- `node-cron` — schedule subscription expiry maintenance.
- `pdfkit` — create PDF reports.
- `cookie-parser`, `cors`, and `dotenv` — session cookie parsing, cross-origin API access, and environment configuration.
- `PyMuPDF` (Python worker dependency, installed from `backend/requirements.txt`) — apply PDF edits and produce saved versions server-side.

### Configuration

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for environment variables, local setup, OAuth, email, payment, PDF worker, and optional integration configuration.
