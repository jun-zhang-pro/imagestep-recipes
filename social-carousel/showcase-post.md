# r/n8n showcase draft — "Sheet row in, 4 carousel cards out, same character on every one"

**What I built**

A content pipeline for our mascot. Marketing keeps a Google Sheet of carousel ideas (`headline`,
`subline`). Every new row becomes four cards with the *same* character in a different scene,
published to a CDN, with the four URLs written back into the row. No design tool in the loop.

**The workflow** (3 nodes + a Code node)

1. **Google Sheets Trigger** — polls for new rows.
2. **ImageStep → Operation → generate**, count 4, prompt built from the row. The consistency part
   is one option: *AI Preset* points at a preset I saved once with three reference photos of the
   mascot attached (`references`). Every call sends those to the model as "this is who the
   character is"; the row's text is the scene. Changing the photos makes a new preset version, so
   I can tell later which batch drew which look.
3. **Code** — flatten the four published URLs into `url1..url4`.
4. **Google Sheets** — update the row by `row_number`.

**The result**

Twenty rows so far. Face, hair and outfit hold within a row and across rows — the old "describe
the character in the prompt" approach drifted after about three cards. Small props still wander
(a mug becomes a cup); plain-background, front-facing reference shots helped more than prompt
tweaks. The node's Dry Run switch shows the row's cost before anything runs.

Template + SDK version:
[imagestep-recipes/social-carousel](https://github.com/jun-zhang-pro/imagestep-recipes/tree/main/social-carousel)
