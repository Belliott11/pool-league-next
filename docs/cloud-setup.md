# Shared data and the public viewer link

By default Poolean Intel keeps its data in the browser. To let friends view the stats without
importing anything, put the data in a free Supabase project. Visitors open the link and see the
stats read-only. One editor account signs in to change things.

This takes about ten minutes and costs nothing. You do these steps, because they create accounts
and keys in your name.

## 1. Create the project

1. Sign up at supabase.com and create a new project (free plan). Pick any name and region and save the
   database password somewhere safe.
2. Wait for it to finish setting up.

## 2. Create the table and permissions

1. Open **SQL Editor** and paste in everything from `supabase/schema.sql`. Run it.

## 3. Create your editor account

1. Open **Authentication, Users** and choose **Add user, Create new user**. Enter your email and a
   strong password. Tick **Auto Confirm User**.
2. Open **Authentication, Sign In / Providers** and turn **off** "Allow new users to sign up", so
   nobody else can create an account.
3. Back in the SQL Editor, make your account an editor (use your own email):

   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
   ```

## 4. Connect the app

1. Open **Project Settings, API**. Copy the **Project URL** and the **anon public** key. The anon key is
   meant to be public. The permissions above are what protect your data, so never use the
   `service_role` key anywhere in this app.
2. Put them in `public/cloud-config.json`:

   ```json
   { "url": "https://YOUR-PROJECT.supabase.co", "anonKey": "YOUR-ANON-KEY" }
   ```
3. Commit and push. The site redeploys on its own.

## 5. Publish your data

1. Open the site, choose **Editor sign-in** in the header, and sign in.
2. If this browser already has your data (from a classic-site import), a bar says **Publish to the
   cloud**. Choose it. If not, import your classic backup first, then publish.
3. Share the site link. Anyone who opens it sees the stats, read-only, with no import and no sign-in.

## How it behaves

- **Visitors** see the latest published data. It refreshes every minute and when they return to the
  tab. They never see add, edit, delete, planner or Export controls, and nothing is written to their
  browser's own copy.
- **The editor** edits as before. Changes save in this browser and to the cloud a moment after each
  edit. The Editing button in the header shows the save status.
- **Two devices:** if you edit from two devices, the second save notices the cloud changed and asks
  whether to use the cloud version or overwrite it with yours.
- **Not synced:** video files stay on the device they were added on.
- **Turn it off:** empty `public/cloud-config.json` (both values blank) and the app goes back to
  keeping data in the browser only.
