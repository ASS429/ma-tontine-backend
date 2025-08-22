# ma-tontine-backend

Node/Express + PostgreSQL (Supabase) backend for the Tontine app.

## Setup (local)

1. Create a PostgreSQL database (or Supabase project).
2. Run `schema.sql` in your DB (Supabase SQL Editor).
3. Copy `.env.example` to `.env` and fill `DATABASE_URL` + `JWT_SECRET`.
4. Install deps: `npm install`
5. Start API: `npm run dev` (or `npm start`)

## Render deployment

- Build Command: `npm install`
- Start Command: `node server.js`
- Environment:
  - `DATABASE_URL` (from Supabase > Connection string > psql)
  - `JWT_SECRET` (any strong secret)
  - `ALLOWED_ORIGIN` (your frontend URL on Render, e.g. https://ma-tontine-frontend.onrender.com)

The API will read `PORT` automatically from Render.

## Routes

- `POST /auth/register` { email, password } -> { token }
- `POST /auth/login` { email, password } -> { token }

Use header: `Authorization: Bearer <token>`

- `GET /tontines` (list)
- `POST /tontines` (create)
- `GET /tontines/:id`
- `PUT /tontines/:id`
- `DELETE /tontines/:id`

- `GET /membres/:tontineId`
- `POST /membres/:tontineId`
- `PUT /membres/edit/:id`
- `DELETE /membres/delete/:id`

- `GET /paiements/:tontineId`
- `POST /paiements`

- `GET /tirages/:tontineId`
- `POST /tirages/run/:tontineId`

- `GET /stats/overview`
