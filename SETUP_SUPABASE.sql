-- Create programs table in Supabase
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/jizqguwujyphqdgpcvjm/sql/new

CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  desc TEXT,
  ver TEXT,
  cat TEXT,
  url TEXT,
  os TEXT[] DEFAULT ARRAY[]::TEXT[],
  coverImage TEXT,
  screenshots TEXT[] DEFAULT ARRAY[]::TEXT[],
  dl INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous read
CREATE POLICY "Allow anonymous read" ON public.programs
  FOR SELECT USING (true);

-- Create policy to allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated write" ON public.programs
  FOR ALL USING (true) WITH CHECK (true);
