# XAPPX — Brand Constraints for Engineering

The full style guide governs design and copy. This file covers only the parts that bind code, and CI enforces them via `tools/check_brand_terms.py`.

---

## 1. The name

The company name is **XAPPX**. The retired names must not appear in copy, metadata, filenames, image labels, code comments, or URLs. <!-- brand-check:allow: ZAPS, ZAPX, ZAPS APX, standalone APX and WTAF are the retired names this rule covers. -->

This is enforced, not advisory. CI fails the build on a match — including in file names and paths, because retired names survive longest in seed data, migration filenames, and comments long after the marketing site is clean.

**"Zap" singular is not banned.** The prohibited list is exactly the plural and the X/APX forms; the `zap_dev` / "Zap Development" product keeps its name. The checker's patterns match only what the guide names — do not widen them. <!-- brand-check:allow -->

Where the style guide's public terminology differs from an internal product code, the toggle system already handles it: `app_products.display_name` overrides the label per brand, so a code can stay `zap_dev` while a customer-facing surface reads "Generative App Development". <!-- brand-check:allow -->

## 2. Terminology in code and copy

| Use | Not |
|---|---|
| AI-native development | vibe coding | <!-- brand-check:allow -->
| Generative app development | vibe coding, "AI writes the app" | <!-- brand-check:allow -->
| AI-to-AI (buyer-facing) | agent-to-agent, in customer copy |
| agent-to-agent (architecture and protocol docs) | AI-to-AI, in technical specs |
| decentralized data vault | secure data vault, where decentralisation is the point | <!-- brand-check:allow -->

**The vault is decentralized, and the schema does not show it yet.** "Decentralized data vault" is the correct term for the product. What `services/vault-service` currently implements is a `storage_key`, a `checksum` and a KMS key reference — a shape that fits centrally operated storage and says nothing about decentralisation either way. That is a gap in the implementation, not a reason to soften the wording. Before Phase 1 closes, the vault schema needs to name the mechanism: content addressing instead of an opaque storage key, where key custody actually sits, and what a node or replica is. Until it does, an auditor reading the schema cannot verify the claim the brand makes.

## 3. Prohibited claims

Never in copy, decks, or API documentation: guaranteed revenue, guaranteed cost savings, autonomous operation without oversight, perfect security, instant deployment, or "no code required" — the last one only becomes available if a verified self-service builder ships. <!-- brand-check:allow -->

**A trap worth naming.** The platform's own definition of done is "a new brand launches with **zero new code**." That is an internal engineering exit test, and it is true. It is not marketing copy, and it must not become "no code required" on a website — those mean different things, and only one of them is a promise to a customer. <!-- brand-check:allow -->

Avoid fear-based replacement framing. XAPPX frees people from low-value repetition and expands what teams can accomplish.

## 4. Visual tokens

`packages/design-system/tokens.json` and `tokens.css` are generated from the style guide. Rules that are easy to break in code:

- The gradient **always** runs left to right, cyan to violet, mirroring the X bookends of the wordmark. Never reversed, never rotated.
- Logo clearspace on all sides equals the height of the X letterform.
- The tagline is dropped below 80px logo width.
- Never recolor the wordmark or place it on low contrast.

**Scope.** These are the XAPPX platform's own defaults — App Factory, Operations, Rewards Admin, and marketing surfaces. Client brand instances override theme values through their application record, and their manifests must never inherit XAPPX colours by accident. A Century 21 instance showing XAPPX cyan is a bug in theme resolution, not a styling preference.

## 5. Running the check

```bash
python3 tools/check_brand_terms.py
```

Errors fail CI. Warnings flag discouraged claims that may be legitimate in internal engineering prose — read them, do not silence them by default. To exempt a line that must state a retired name (documentation like this file), add the allow marker described at the top of the checker.
