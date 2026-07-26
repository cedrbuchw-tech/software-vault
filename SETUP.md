# DETAILED Setup Instructions

Follow these steps **exactly in order**. Each step tells you where to go and what to do.

---

## STEP 1: Create the Database Table in Supabase

### 1a. Open Supabase Dashboard
- Open your browser
- Go to: `https://app.supabase.com`
- You should see your projects listed
- Look for project named: **jizqguwujyphqdgpcvjm**
- Click on it

### 1b. Open SQL Editor
- Once inside your project, look at the **LEFT SIDEBAR**
- Click on **SQL Editor** (you'll see a icon that looks like brackets `{}`)
- At the top right, you'll see a button that says **"New Query"**
- Click it

### 1c. Paste the SQL Code
- In the text editor that appears, **CLEAR everything** (Ctrl+A, then Delete)
- Open the file **`SETUP_SUPABASE.sql`** (in your project root), copy its **entire contents**, and paste them in.
- That one file creates everything — the `programs` and `settings` tables **and** the user-accounts tables (`profiles`, `likes`) with all their security rules. It's safe to re-run.

### 1d. Run the SQL
- At the **bottom right** of the SQL editor, you'll see a **"Run"** button (or press Ctrl+Enter)
- Click it
- You should see green text saying **"Success"** or similar
- ✅ If you see success, Step 1 is done!

### 1e. Turn on email login (for user accounts)
- Left sidebar → **Authentication** → **Providers** → make sure **Email** is enabled.
- For instant test signups, also turn **off** "Confirm email" in the Email settings. Leave it **on** for real use, and set **Authentication → URL Configuration → Site URL** to `https://softwarevault.dev`.
- ✅ Sign up / log in and per-account likes are now ready.

---

## STEP 2: Set Up Resend (Email Service)

### 2a. Sign Up for Resend
- Open a new browser tab
- Go to: `https://resend.com`
- Click **"Sign Up"** (top right)
- Enter your email address
- Click **"Continue"**
- Check your email inbox for a verification link from Resend
- Click that link to verify
- Complete any additional setup (name, password, etc.)

### 2b. Get Your API Key
- After you're logged into Resend, look for the **left sidebar menu**
- Click on **"API Keys"** or **"Settings"** → **"API Keys"**
- You should see a table with one key that says something like: `re_xxxxxxxxxxxxxxxxxxxxx`
- The key will look long like: `re_1234567890abcdefghijklmnop`
- **Click the copy button** (usually an icon next to it) to copy this key
- ✅ Save this key somewhere safe (you'll need it next)

---

## STEP 3: Add the API Key to Your Local `.env.local` File

### 3a. Open `.env.local` in Your Code Editor
- In VS Code (or your code editor), open the file: `.env.local`
- It's in the **root folder** of your project (same level as `package.json`)
- You should see lines like:
```
NEXT_PUBLIC_SUPABASE_URL=https://jizqguwujyphqdgpcvjm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_SECRET=sb_secret_...
```

### 3b. Add the Resend Key
- Go to the **end of the file** (after the last line)
- Press **Enter** to create a new line
- Type this (replace `re_xxxxx` with your actual key from Step 2b):
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@your-verified-domain.com
```
- **Example** (if your key was `re_abc123def456` and your domain is `example.com`):
```
RESEND_API_KEY=re_abc123def456
RESEND_FROM_EMAIL=noreply@example.com
```

> If you want to send emails to other recipients, verify a domain in your Resend dashboard at `https://resend.com/domains` and use a matching `RESEND_FROM_EMAIL` address.

### 3c. Save the File
- Press **Ctrl+S** (Windows) or **Cmd+S** (Mac)
- ✅ File saved!

---

## STEP 4: Add the API Key to Vercel (For Your Live Website)

### 4a. Open Vercel Dashboard
- Open a browser tab
- Go to: `https://vercel.com/dashboard`
- Log in if needed
- You should see your projects listed

### 4b. Click Your Project
- Look for a project named: **software-vault**
- Click on it
- You're now inside your project

### 4c. Go to Settings
- At the **top of the page**, you'll see tabs: **Deployments**, **Analytics**, **Settings**, etc.
- Click **Settings**

### 4d. Find Environment Variables
- In the **left sidebar** of Settings, look for **"Environment Variables"**
- Click on it
- You'll see a section that says "Environment Variables" with a list below it

### 4e. Add the New Variable
- Look for a **text field** or **"Add"** button that says something like "Add new"
- Click it
- A form will appear asking for:
  - **Name**: Type `RESEND_API_KEY`
  - **Value**: Paste your key from Step 2b (like `re_abc123def456`)
- Click **"Save"** or **"Add"**
- ✅ You should see it in the list now

---

## STEP 5: Test Locally (Optional but Recommended)

### 5a. Install the New Package
- Open your **terminal/command prompt**
- Navigate to your project folder (where `package.json` is)
- Type this command and press Enter:
```bash
npm install
```
- Wait for it to finish (you'll see "added X packages" or similar)

### 5b. Start the Dev Server
- In the same terminal, type:
```bash
npm run dev
```
- You should see:
```
- ready started server on 0.0.0.0:3000
```
- Open your browser to: `http://localhost:3000`

### 5c. Test the App
- Click the admin button (top right, "ADM →")
- Set up a password and email if you haven't
- Add a program through the admin panel
- **Refresh the page** (F5)
- Your program should still be there ✅

### 5d. Stop the Server
- In your terminal, press **Ctrl+C** to stop the dev server

---

## STEP 6: Deploy to Vercel

### 6a. Commit Your Code Changes
- Open your terminal in your project folder
- Run these commands one by one:
```bash
git add .
git commit -m "Add Supabase programs sync and Resend email support"
git push origin main
```
- Wait for each command to complete

### 6b. Vercel Auto-Deploys
- Go back to your browser with Vercel open
- You should see a **"Deployments"** tab at the top
- Click on it
- You should see a new deployment appearing (might show "Building..." or "Running...")
- Wait for it to finish (look for a green checkmark)
- Once it says "Production" with a green checkmark, ✅ you're done!

### 6c. Test Your Live Website
- At the top of the Vercel page, you'll see a URL like: `https://software-vault-xxxxx.vercel.app`
- Click it to open your live website
- Try adding a program through the admin panel
- **Refresh the page** - the program should still be there
- ✅ Everything working!

---

## WHAT YOU CHANGED

✅ **Programs now save permanently** - They sync to Supabase automatically  
✅ **Your website shows your content** - Banner, programs, everything displays  
✅ **2FA email codes work** - Admin gets codes emailed via Resend  
✅ **User accounts** - Visitors can sign up / log in (header button); sessions persist  
✅ **Per-account likes** - Likes are tied to the account and follow people across devices  

---

## TROUBLESHOOTING

**If the website is still blank:**
- Did you run Step 1 (create the table)?
- Did you wait for Vercel deployment to finish (green checkmark)?
- Try refreshing the page (Ctrl+Shift+R for hard refresh)

**If 2FA emails don't arrive:**
- Did you add the Resend key to Vercel in Step 4?
- Check your spam/junk folder
- Make sure you use your real email when setting up admin

**If you get errors in the console:**
- Press F12 in your browser → click "Console" tab
- Paste any error messages here so I can help

---

Done? 🎉 Your app is now fully functional!

