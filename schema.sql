-- Enable extensions (Supabase usually has pgcrypto by default)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Users table (if not using Supabase Auth directly)
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (position('@' in email) > 1),
  password_hash text not null,
  created_at timestamptz default now()
);

-- Tontines
create table if not exists tontines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  nom text not null,
  type text not null check (type in ('hebdomadaire','mensuelle','autre')),
  montant numeric(12,2) not null check (montant >= 0),
  membres_max integer check (membres_max is null or membres_max > 0),
  statut text not null default 'active' check (statut in ('active','inactive','terminee')),
  created_at timestamptz default now()
);

-- Members
create table if not exists membres (
  id uuid primary key default gen_random_uuid(),
  tontine_id uuid references tontines(id) on delete cascade,
  nom text not null,
  prenom text,
  identifiant text,
  created_at timestamptz default now()
);

-- Payments
create table if not exists paiements (
  id uuid primary key default gen_random_uuid(),
  tontine_id uuid references tontines(id) on delete cascade,
  membre_id uuid references membres(id) on delete cascade,
  montant numeric(12,2) not null check (montant >= 0),
  periode date not null,
  created_at timestamptz default now(),
  unique (tontine_id, membre_id, periode)
);

-- Draws
create table if not exists tirages (
  id uuid primary key default gen_random_uuid(),
  tontine_id uuid references tontines(id) on delete cascade,
  membre_id uuid references membres(id) on delete cascade,
  ordre integer not null,
  date_tirage date not null default current_date,
  created_at timestamptz default now(),
  unique (tontine_id, ordre),
  unique (tontine_id, membre_id)
);
