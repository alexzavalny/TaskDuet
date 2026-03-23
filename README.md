# TaskDuet

Minimal MVP starter for the two-person shared to-do app described in the spec.

## Stack

- React 19
- TypeScript
- Vite
- Supabase Auth + Postgres + RLS

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Apply the SQL in [supabase/schema.sql](/Users/alex/Projects/TaskDuet/supabase/schema.sql).
5. Run `npm run dev`.

## What is included

- Email/password auth shell
- Profile bootstrap assumptions
- Invite-code pairing flow through a Supabase RPC
- Day / week / month switching
- Two-column task board
- Rollover visibility without task duplication

## Notes

- The app expects the SQL function `create_pair_with_invite` to exist.
- Completed tasks remain visible only in the period where they were completed, matching the MVP spec.
- Realtime subscriptions are not wired yet; the current build uses explicit refresh after writes.
