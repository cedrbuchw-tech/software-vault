-- ============================================================================
--  Migration: Add 2FA support to profiles table
--  Run this ONCE in the Supabase SQL editor to add 2FA columns
-- ============================================================================

-- Add 2FA columns to profiles table if they don't exist
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS two_fa_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS two_fa_secret text,
ADD COLUMN IF NOT EXISTS two_fa_secret_temp text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_two_fa_enabled 
ON public.profiles(id) WHERE two_fa_enabled = true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.two_fa_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN public.profiles.two_fa_secret IS 'TOTP secret key (Base32 encoded) - only set when 2FA is enabled';
COMMENT ON COLUMN public.profiles.two_fa_secret_temp IS 'Temporary TOTP secret during 2FA setup - deleted after verification';
