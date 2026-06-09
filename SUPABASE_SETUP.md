Supabase setup instructions

If you're seeing the error "Could not find the table 'public.programs' in the schema cache", create the `programs` table and the `files` storage bucket in your Supabase project.

SQL you can run in the Supabase SQL editor:

```sql
create table if not exists public.programs (
  id text primary key,
  name text not null,
  description text,
  ver text,
  category text,
  os text[],
  featured boolean default false,
  likes integer default 0,
  url text,
  file_path text,
  file_name text,
  file_size integer,
  cover_url text,
  screenshots jsonb,
  date timestamptz default now(),
  dl integer default 0
);

-- ensure settings table exists (used to store admin hash and site settings)
create table if not exists public.settings (
  key text primary key,
  value text
);
```

Create a storage bucket named `files` (public) for uploaded files.

After creating the table and bucket, re-deploy or re-run your upload and program APIs.
