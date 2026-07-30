# TapUSA Menus

TapUSA Menus is a multi-tenant digital restaurant menu platform. It includes a
restaurant owner workspace, a TapUSA Super Admin portal, and public menu pages at
`menus.tapusa.online/<restaurant-slug>`.

The backend uses Supabase PostgreSQL, Auth, Storage, Row-Level Security, and an
Edge Function for privileged account operations.

## Requirements

- Node.js 22.12 or newer
- npm
- Docker Desktop for the local Supabase stack

The repository declares the required Node version in `package.json`. The
Supabase JavaScript client currently requires Node 22.

## Install and run

```powershell
npm install
Copy-Item .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

After `supabase start`, copy the displayed API URL and anon key into `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key>
VITE_SITE_URL=http://localhost:4173
```

Open `http://localhost:4173`.

Local seed accounts:

- Super Admin: `admin@tapusa.local`
- Restaurant Owner: `owner@emberandoak.local`
- Password for both: `TapUSA-Demo-2026!`

These credentials are for local development only.

## Demo mode

When the Supabase environment variables are absent, the app runs in explicit
frontend demo mode and stores changes in browser `localStorage`. Once valid
Supabase variables are present, authentication and all writes use Supabase;
backend errors are shown instead of silently falling back to local data.

## Backend structure

- `supabase/migrations/`: schema, indexes, triggers, RLS, storage policies, public
  menu RPC, and atomic reorder functions.
- `supabase/seed.sql`: local users and the Ember & Oak sample menu.
- `supabase/functions/admin-restaurants/`: privileged owner invitations, account
  changes, disable/enable, password resets, deletion, and audit events.
- `api/import-menu.js`: authenticated Vercel Function that extracts structured
  menu data from owner-uploaded photos with AI Gateway.
- `src/lib/`: browser-safe Supabase client configuration.
- `src/services/`: auth, restaurants, menu CRUD, uploads, admin actions, and row
  mapping.

Public users can read only active, published restaurants and available items.
Owners can access only restaurants assigned through `restaurant_memberships`.
The service-role key is used only inside the Edge Function and must never be
added to a `VITE_` environment variable.

## Edge Function locally

Create `supabase/.env.local`:

```dotenv
SITE_URL=http://localhost:4173
```

The Supabase CLI supplies local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` values to functions.

```powershell
npm run supabase:functions
```

## Connect a hosted Supabase project

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy admin-restaurants
npx supabase secrets set SITE_URL=https://menus.tapusa.online
```

Set the hosted project URL and anon key in the deployment platform. Configure
Auth redirect URLs for `https://menus.tapusa.online` and configure an SMTP
provider before sending production invitations or password-reset emails.

To bootstrap the first Super Admin, create the user through Supabase Auth and
then run this once from the SQL editor:

```sql
update public.profiles
set role = 'super_admin'
where email = 'your-admin@tapusa.com';
```

All subsequent owner accounts are created from the Super Admin portal.

The production host must rewrite unknown paths to `/index.html` so restaurant
slugs such as `/ember-and-oak` reach the client application.

## AI menu photo import

Owners can upload one to three JPG, PNG, or WebP menu photos from the Menu
Manager. Images are resized in the browser, temporarily stored in the
restaurant's private Supabase import bucket, and removed after extraction.
Owners must review and approve the editable result before categories and items
are appended. Confirmation is idempotent, so a network retry cannot duplicate
the imported categories.

The API verifies the Supabase access token and restaurant membership before
calling AI Gateway. The database limits each restaurant to five extraction
attempts per calendar month. Apply the latest migration before enabling it:

```powershell
npx supabase db push
```

Vercel production deployments authenticate to AI Gateway with their generated
`VERCEL_OIDC_TOKEN`. For local testing, add a server-only
`AI_GATEWAY_API_KEY` to `.env.local` and run the app through Vercel so the
`/api/import-menu` function is available:

```powershell
npx vercel dev
```

## Verification

```powershell
npm test
npm run build
```

To recreate and validate the local database from scratch:

```powershell
npx supabase db reset
```
