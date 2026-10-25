# Bhojpuri review queue

The translate CLI writes `bho-<batch>.md` here after every Bhojpuri run: up to 50 randomly chosen snippets with the English beside the Bhojpuri draft. The owner ticks each box or writes the corrected text under it (see `docs/OWNER-TODO.md`, item 6). Reviewed batches are flipped to `review: "reviewed"` in `packages/content/corpus/<domain>/bho.json`.
