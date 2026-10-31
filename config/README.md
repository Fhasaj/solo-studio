# Site config

Optionally put a `site.json` here with starting values for any setting in Admin → Settings (keys are listed in
`src/lib/siteSettings.ts`, or use **Export settings** on the Settings page to get a complete file).

```json
{
  "siteName": "Acme Dev",
  "ownerName": "Alex Morgan",
  "town": "Leeds",
  "heroHeadline": "Custom software for Yorkshire businesses"
}
```

Anything saved in the admin takes priority over this file. Bank details are never read from here: enter them in the
admin, where they're stored encrypted.
