# Rich Presence Asset Verification

Date: 2026-09-04
Portal: https://discord.com/developers/applications/982308134871765022/rich-presence/assets
Application shown by Portal: Warmaster

## Result

The authenticated Discord Developer Portal displayed 133 Rich Presence asset rows and 130 unique keys. The local `data/icon-registry.json` contains 130 keys, and its key set matches the Portal's 130 unique keys exactly.

The Portal displayed these repeated rows:

- `skarn_comment` (2 rows)
- `skarn_image` (2 rows)
- `skarn_snow` (2 rows)

No local registry key was missing from the Portal list, and the Portal exposed no unique key absent from the local registry.

## Cache findings

The local phrase cache contains 8,903 phrase entries using 148 unique asset keys. The following 18 keys occur in the cache but were not present in the authenticated Portal asset list:

```text
skarn_alignment
skarn_alignment_center
skarn_clipboard
skarn_crop
skarn_dollars
skarn_expclamation_mark
skarn_fish
skarn_headbeat
skarn_ladder
skarn_lightning
skarn_mail
skarn_move
skarn_movie
skarn_scroll
skarn_shadow
skarn_smile
skarn_stop
skarn_sword
```

These keys are unverified/stale for the current application. The standalone RPC script can randomly select them, so those rotations may lack a small image.

## Large image check

`rich-presence.js` currently sends `largeImageKey: 'skarn_logo'`. `skarn_logo` was not present in the Portal's 130 unique Rich Presence asset keys. The large image should therefore be verified separately or changed to one of the confirmed uploaded keys.

## Scope and limits

This verifies the key names visible in the authenticated Portal page. It does not verify individual image dimensions, visual quality, or whether the repeated Portal rows represent distinct underlying uploads. Discord's page states that Rich Presence assets recommend 1024x1024 images and require at least 512x512.

## Recommended follow-up

1. Review the archived unsupported and duplicate phrases after the next RPC restart.
2. Restore any archived phrases only after uploading matching assets and adding them to the registry.
3. Confirm what should replace `skarn_logo` as the large image, or upload a `skarn_logo` asset.
## Remediation status

rich-presence.js now canonicalizes the eight safe aliases, removes the three duplicate phrase entries from active rotation, and archives the ten unsupported keys plus those duplicates. The current 8,903-entry cache will migrate on the next RPC restart: 8,890 entries will remain active and 13 will move to the new archive field. The currently running PM2 process was not restarted automatically.

The skarn_logo large-image mismatch remains unresolved.

## Mood classification

The full pre-prune corpus was normalized with the same asset-alias, unsupported-key, rewrite, and case-insensitive duplicate rules used by the RPC. It produced exactly 8,890 phrases, and every phrase received one mood label through 89 resumable batches using gpt-4.1-mini.

Classification counts:

- displeased: 4,455
- pondering: 2,358
- dormant: 1,160
- observing: 917

The current active 500 phrases all have a matching classification. The output is stored in data/rpc-phrase-moods.json, with a resumable checkpoint in data/rpc-phrase-moods.progress.json. The labels are semantic model judgments, not ground truth; the high displeased share should be reviewed if the live presence feels too hostile.

## Cache growth policy

Before pruning, the cache was backed up to data/backups/rpc-phrases-pre-prune-2026-09-04.json. The active pool is now bounded to the newest 500 entries, and the archive is bounded to 2,000 entries. Regeneration remains a 50-entry batch but runs every 12 hours. Startup no longer generates a new batch when an active pool already exists.

The migration preview for the current cache is 500 active entries and 2,000 retained archive entries. This includes 10 unsupported-asset entries, 3 duplicate entries, and 1,987 of the older overflow entries. The running PM2 process must be restarted manually for migration to occur.
