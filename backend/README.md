# W3Villa API

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

The API listens on port `5000` by default. Configure `MONGO_URI`, a random `AUTH_TOKEN_SECRET` with at least 32 characters, `FRONTEND_URL`, and comma-separated `CLIENT_URLS` in `.env`. Generate a session secret with `openssl rand -base64 48`.

Google sign-in requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth web client. Set the authorized redirect URI to `http://localhost:5000/api/auth/google/callback` (or match `GOOGLE_CALLBACK_URL`). Start sign-in at `GET /api/auth/google`; Google returns to `GET /api/auth/google/callback`, which creates the app session cookie.

Facebook sign-in requires a Facebook app with Facebook Login enabled. Set `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`, add `http://localhost:5000/api/auth/facebook/callback` (or your `FACEBOOK_CALLBACK_URL`) to its Valid OAuth Redirect URIs, enable the email permission, and set `FACEBOOK_FRONTEND_URL` to the frontend origin. A Facebook sign-in with an email matching an existing account automatically connects Facebook to that account, including an existing Google account, so the user can sign in with either provider. New Facebook users can create an account with the Facebook button.

Create an admin from the backend directory with `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` set in the environment, then run `npm run create-admin`. If the email already belongs to a user, the script promotes that account without changing its password. For a new account, the password must be 8 to 72 characters and is stored as a bcrypt hash.

Email verification and verification email delivery are currently disabled. Signup creates the account and signs the user in immediately; SMTP settings are not required for authentication.

### Stripe PDF passes

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the backend `.env`. Never put Stripe secret keys in the frontend environment. For local testing, run `stripe listen --forward-to localhost:5000/api/payments/webhook` and set `STRIPE_WEBHOOK_SECRET` to the signing secret printed by Stripe CLI. Configure the Stripe account for INR payments. The day pass is a one-time ₹10 payment for 24 hours; the monthly pass is a one-time ₹200 payment for one calendar month. Access is recorded only after Stripe confirms payment.

Default day/month plans are inserted when the plans collection is empty. Admins can create, update, draft, and delete plans from the admin panel. A plan with purchase history is archived instead of physically removed. Plan duration supports hours, days, weeks, months, or years.

## Endpoints

- `GET /` returns API status and the health-check path.
- `GET /api` returns API metadata.
- `GET /api/health` returns service health and uptime.
- `GET /api/plans` returns active plans for the user pricing page.
- `POST /api/auth/signup` creates an email/password account and signs the user in immediately.
- `POST /api/auth/verify-email` verifies an unexpired token from a previously issued verification link.
- `POST /api/auth/resend-verification` is temporarily disabled.
- `POST /api/auth/login` signs in an account and sets an HttpOnly session cookie.
- `GET /api/auth/google` starts Google OAuth; `/api/auth/google/callback` validates the response and creates the app session.
- `GET /api/auth/facebook` starts Facebook signup/login; `/api/auth/facebook/callback` validates the response and creates the app session.
- `GET /api/auth/facebook` starts Facebook sign-up/login; `/api/auth/facebook/callback` validates the response and creates the app session.
- `POST /api/auth/logout` clears the session cookie.
- `GET /api/auth/me` returns the current authenticated user.
- `GET /api/admin` requires a verified admin account.
- `GET /api/admin/plans` lists all plans; `POST`, `PATCH /:planId`, and `DELETE /:planId` manage the catalog.
- `GET /api/admin/cronjobs/subscription-expiry` returns the subscription expiry job status.
- `POST /api/admin/cronjobs/subscription-expiry` creates or recreates the expiry job; `DELETE` removes it from scheduling.
- `PATCH /api/admin/cronjobs/subscription-expiry` pauses or enables the scheduled job; `POST /api/admin/cronjobs/subscription-expiry/run` executes it immediately.
- `POST /api/payments/checkout` creates an authenticated Stripe Checkout session for the day or month pass.
- `POST /api/payments/confirm` verifies a completed Checkout session for the signed-in user.
- `GET /api/payments/subscription` returns the signed-in user's current pass status.
- `POST /api/payments/webhook` accepts Stripe-signed Checkout completion events.

Unknown routes and request errors return JSON error responses. JSON request bodies are limited to 1 MB, and CORS origins are configured through `CLIENT_URLS`.

The subscription expiry worker runs every minute after backend startup. The admin can pause automatic status cleanup or run it manually; downloads are still gated by the saved expiry timestamp even while the cleanup job is paused.

## Structure

- `server.js` starts the HTTP server and handles shutdown signals.
- `src/app.js` configures Express middleware and mounts routes.
- `src/config/env.js` loads and exposes environment configuration.
- `src/routes/` contains API route definitions.
- `src/controllers/` contains request handlers.
- `src/middleware/` contains not-found, error, and role authorization middleware.

Passwords are hashed with bcrypt. Verification tokens are single-use, stored as hashes, and expire after 24 hours. Session cookies are HttpOnly and use Secure in production. User roles are assigned by the server/database; signup never accepts a role from the client.

SMTP and session signing configuration are required for signup/login. The frontend and backend must use matching local/production origins for credentialed CORS. Password reset and other business routes are not implemented yet.