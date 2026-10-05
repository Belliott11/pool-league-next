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

## Game videos

You can upload a game video from the game page and everyone with the site link can watch it.

1. In the Supabase dashboard open **SQL Editor**, paste the contents of `supabase/storage.sql`, and run it. It is safe to run again.
2. Open a game while signed in as an editor and choose **Upload video**.

Limits on the free plan: each video can be at most 50 MB, and all your videos together can use about 1 GB. Trim phone clips before uploading. A video that is too big is refused with a message before anything uploads.

Visitors can watch because the video bucket is public: anyone who has a video's address can open it, but only editors can upload, replace or delete.

If a video is too big, paste a link instead (a YouTube or Vimeo link, or a direct .mp4 link). Links use no storage. YouTube and Vimeo videos play in the page, but jumping to a moment from a clip only works for uploaded files.

## Big videos with Cloudflare R2 (any size, free up to 10 GB)

Phone videos are usually far over 50 MB. With R2 set up, **Upload video** sends the file straight from the phone to Cloudflare. The site still works without this: files under 50 MB then go to Supabase as above.

1. **Cloudflare account.** Sign up free at cloudflare.com, then open **R2 Object Storage** in the sidebar. It asks for a card to enable R2, but the free tier (10 GB stored, no charge for viewing) does not bill.
2. **Bucket.** Create a bucket, for example `pool-league-videos`.
3. **Public address.** Open the bucket, then **Settings**, then **Public Development URL**, and enable it. Copy the address (`https://pub-....r2.dev`).
4. **CORS.** In the same Settings page, under **CORS policy**, add:
   ```json
   [
     {
       "AllowedOrigins": ["https://belliott11.github.io"],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
5. **API token.** On the R2 overview page choose **Manage API Tokens**, then **Create API Token**. Give it **Object Read & Write** on just this bucket. Copy the **Access Key ID**, the **Secret Access Key**, and your **Account ID** (shown on the R2 overview page).
6. **Signing function.** In the Supabase dashboard open **Edge Functions**, then **Deploy a new function** and **Via Editor**. Name it `video-sign`, paste the contents of `supabase/functions/video-sign/index.ts`, and deploy.
7. **Secrets.** In Supabase, **Edge Functions**, **Secrets**, add these five:

   | Name | Value |
   | --- | --- |
   | `R2_ACCOUNT_ID` | your Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | the access key ID from step 5 |
   | `R2_SECRET_ACCESS_KEY` | the secret from step 5 |
   | `R2_BUCKET` | the bucket name from step 2 |
   | `R2_PUBLIC_URL` | the `https://pub-....r2.dev` address from step 3 |

Then sign in as an editor, open a game, and upload. The secret key stays inside Supabase; the page only ever sees a link that works for one hour and one file. Only accounts in the `admins` table can get one.

## Version history and backups

Every save replaces the one shared copy, so history is the safety net for a bad publish or an accidental delete.

1. In the Supabase dashboard open **SQL Editor**, paste the contents of `supabase/history.sql`, and run it. It is safe to run again.
2. As an editor, open the account menu and choose **Past versions**. Each row is the data as it was before a save. A snapshot is taken at most every 30 minutes, and always when a save would leave fewer games than before (a delete). The newest 100 are kept.
3. **Restore** brings a version back. The data as it is now is kept in the list first, so a restore can be undone.

**Download a backup** in the same menu saves the current data as a file on your device, which is worth doing now and then.

Videos over 64 MB upload to R2 in 16 MB parts, so a dropped connection repeats one part instead of the whole video. This needs the current `supabase/functions/video-sign/index.ts`; after updating the repo, paste it into the function again and redeploy it. Smaller files, and any case where the function is out of date, use the single-request upload.

## Anyone keeping score

Anyone who opens the site can help keep score of the live game, with no account and no code. They can only add a basket for a player in the live game and undo the last basket added this way. They cannot start, finish, edit or delete anything, and when no game is live it does nothing.

1. In Supabase open **Edge Functions**, then **Deploy a new function**, then **Via Editor**. Name it `live-score` and paste the contents of `supabase/functions/live-score/index.ts`.
2. Open the function's settings and turn **off** "Verify JWT", because visitors are not signed in.
3. Deploy the function. There is nothing else to set up.

How it works on the night: you (the editor) start the live game as usual. A friend opens the site, taps the live banner, then **Keep score**, and taps baskets for players. Everyone watching sees them within a few seconds. Your app picks up their baskets by itself while a game is live, and your own baskets are never overwritten. When you finish the game, their baskets are counted in the final score.

Because there is no code, anyone with the link could add a basket during a live game. If that ever becomes a problem, you can finish or discard the game, or remove the `live-score` function to turn it off.
