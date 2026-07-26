# 2FA & Password Reset Setup

## Database Migration

Before using 2FA features, you need to run the migration to add the required columns to the `profiles` table:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `MIGRATION_2FA.sql`
5. Run the query

This will add three new columns to the profiles table:
- `two_fa_enabled` - Boolean flag for 2FA status
- `two_fa_secret` - TOTP secret key (Base32 encoded)
- `two_fa_secret_temp` - Temporary secret during setup

## Features Implemented

### 1. Password Reset
- Users can click "Forgot password?" on the login screen
- They enter their email and receive a password reset link
- The email link redirects to the site where they can set a new password
- Supabase handles the password reset via its built-in Auth endpoints

**Configuration needed in Supabase:**
- Go to Authentication → Email Templates
- Configure the "Reset Password" email template with your custom redirect URL

### 2. Two-Factor Authentication (2FA)

#### Setup Process
1. User goes to Account settings (click their username in header)
2. Click "Enable 2FA"
3. Scan QR code with authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
4. Enter the 6-digit code from the app
5. 2FA is now enabled

#### Disable Process
1. Go to Account settings
2. Click "Disable 2FA"
3. 2FA is immediately disabled

#### How TOTP Works
- Uses industry-standard TOTP (Time-based One-Time Password)
- 6-digit codes valid for 30 seconds
- Works with any standard authenticator app
- No dependency on SMS or external services

## API Routes

### POST `/api/auth/2fa/setup`
**Body:** `{ userId: string }`

**Response:** 
```json
{
  "secret": "ABCDEFGHIJKLMNOP",
  "qrCode": "https://api.qrserver.com/v1/create-qr-code?..."
}
```

### POST `/api/auth/2fa/verify`
**Body:** `{ userId: string, code: string, secret: string }`

**Response:** `{ success: true }`

### POST `/api/auth/2fa/disable`
**Body:** `{ userId: string }`

**Response:** `{ success: true }`

### POST `/api/auth/reset-password`
**Body:** `{ email: string, redirectTo?: string }`

**Response:** `{ success: true }`

## Security Notes

1. **2FA Secrets are never logged** - Only stored in database, temporarily in setup state
2. **TOTP is standard** - Uses HMAC-SHA1 with 30-second window (±1 window for clock skew)
3. **Password reset emails** - Only valid for 1 hour (Supabase default)
4. **No SMS required** - App-based authentication reduces attack surface

## Testing

### Test 2FA Locally
1. Run the application locally
2. Create an account or sign in
3. Click your username → Enable 2FA
4. Scan QR code with authenticator app
5. Copy code from app and verify

### Test Password Reset Locally
1. Create an account
2. Click "Forgot password?"
3. Enter your email
4. Check terminal logs (Supabase CLI shows email preview in dev mode) or email inbox
5. Click the reset link
6. Supabase Auth will handle the password change

## Notes

- Session restoration on page refresh is automatic via Supabase Auth
- 2FA check is planned for future Login flow implementation
- Backup codes for 2FA are not yet implemented
- Recovery mechanisms (like backup email) are not yet implemented

## Next Steps

To fully implement 2FA for login protection, you'll need to:
1. Create a 2FA verification component that appears during login
2. Check 2FA status in your login API route
3. Require code verification before session creation
4. Implement backup codes or recovery options
