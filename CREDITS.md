# Credits and sources

## Roster data

The group and member list comes from **https://mygirlnine.pages.dev/**
("여돌 구절판"), fetched 2026-09-26. That site is the primary data source for this
project.

Per-group profile data (name, generation, debut date) is referenced from
**kprofiles.com** through the `source` field on each group in `data/roster.json`.

## Photos

Member profile photos were mirrored from `https://mygirlnine.pages.dev/photos/`
and verified against the `sha256` values in `data/photo-sources.json`: 457 of 475
files are byte-identical to what that site serves. Sizes vary widely — 262
distinct sizes, from 301x297 up to 1731x1550, with only one at 640x800 — because
the photos were gathered from many sources.

`data/photo-sources.json` records, for every photo:

- `sourceUrl` — the kprofiles profile page used as reference
- `imageUrl` — the original image URL on kprofiles
- `sourceType` — `web-download-edited`, `official-web-link`, or `user-upload`
- `providedFile` — original filename for operator-provided photos
- `sha256` — checksum of the file served by the source site

The source site states: "사진 권리는 원 권리자에게 있습니다" — photo rights remain
with their original holders.

## Usage limits

The roster and photos are **not** owned by this project. This repository is for
personal use. **Do not** use it commercially, and **do not** present it as your
own work. The photo attribution above must stay intact for as long as the photos
are distributed with the code.

## Code

The code in this repository was written from scratch. The phase structure
(setup → heat → sort → result), poster layout, and data schema follow the
behaviour of the source site so results stay comparable; search, i18n, undo, and
the accessibility work are additions in this version.
