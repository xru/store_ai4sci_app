# Waitlist-gated listing downloads

> Listing file downloads (demo / dataset zip) are unlocked by joining that
> listing's waiting list — not by bumping `users.access_tier`.

## Behaviour

1. Before join: `GET /api/apps/:slug` returns `has_demo` / `has_dataset` /
   `joined_waitlist` only. **No** `demo_url`, `dataset_url`, or any
   `r2.dev` / http file URL in JSON or HTML.
2. After the logged-in user `POST /api/waitlist` with `{ "app_slug": "…" }`:
   detail response may include `demo_download` / `dataset_download` as
   Worker paths (`/api/apps/:slug/files/demo|dataset`).
3. File GETs require login + waitlist row for that slug (admins bypass).
   Worker streams from the `BUCKET` binding (`ai4sci-assets`) when possible;
   if the DB still has an http(s) URL it fetches server-side and streams —
   never 302 to the public URL.

Preferred DB storage format:

```text
r2:listings/wcm/wcm-website.zip
```

## Production one-liners (WCM)

Upload the zip into the bound bucket, then rewrite the D1 row so the Worker
serves an internal ref instead of a public `r2.dev` URL:

```sh
# 1) Put object into ai4sci-assets
npx wrangler r2 object put ai4sci-assets/listings/wcm/wcm-website.zip \
  --file=./wcm-website.zip \
  --content-type=application/zip

# 2) Point the listing at the internal ref (adjust columns as needed)
npx wrangler d1 execute ai4sci-db --remote --command="UPDATE apps SET dataset_url='r2:listings/wcm/wcm-website.zip', demo_url=NULL WHERE slug='wcm'"
```

If `demo_url` also held the same zip, set it the same way:

```sh
npx wrangler d1 execute ai4sci-db --remote --command="UPDATE apps SET demo_url='r2:listings/wcm/wcm-website.zip', dataset_url='r2:listings/wcm/wcm-website.zip' WHERE slug='wcm'"
```

## Apply migration

```sh
npm run db:migrate:local   # local
npm run db:migrate         # remote — 0006_waitlist_listing.sql
```

Migration `0006` adds `waitlist.user_id` + `waitlist.app_slug`, drops the
old unique-on-email index, and adds a unique index on
`(email, ifnull(app_slug,''))`.
