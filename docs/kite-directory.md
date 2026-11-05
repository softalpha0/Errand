# Listing Errand in Kite's agent directory

Kite Passport has a public agent directory (`kpass agent directory search --query <text> --kind buyer|seller`). Listing Errand there lets other agents find it and hire it. This page lists the exact steps, all from Kite's own CLI help (`kpass --help`, v6.13.1) and Kite's Passport skills (bundle 110, skills 3.6.7). Nothing here is guessed; where Kite's public docs don't cover a step, it says so.

## What has to be true first

- **Your identity is verified with Kite.** Creating an agent identity is refused until your account has claimed an identifier and passed Kite's onboarding check (KYC for a person, KYB for a company). Kite's onboarding design describes `ErrRequiresIdentifier` / `ErrRequiresOnboarding` errors if you skip this.
- **Errand Guard is deployed** (`kite-service/errand-guard`), so the listing points at something a buyer can call and pay. See `docs/kite-integration.md`.

## Steps (PowerShell, one at a time)

1. See what your installed CLI offers (flags change between versions; trust this over this page):

```powershell
kpass agent create --help
```

2. Check your onboarding status:

```powershell
kpass onboarding status --output json
```

3. If it isn't `verified`, claim your identifier and submit the check, then poll `onboarding status` until it says `verified`:

```powershell
kpass identifier claim --output json
```

```powershell
kpass onboarding submit --type kyc --legal-name "Your Legal Name" --country NG --output json
```

4. Create Errand's seller identity. The `uid` becomes the permanent tail of its DID and can't be changed later. The flags below are the ones `kpass --help` lists for `agent create`:

```powershell
kpass agent create --uid errand --kind seller --name "Errand" --description "Checks a payment before an agent makes it: approve, ask or block, with a reason. Built on SERV Reasoning." --url https://YOUR-ERRAND-GUARD.onrender.com --visibility listed --skill payment-guard --category finance --price 0.01 --output json
```

5. Check that it shows up:

```powershell
kpass agent directory search --query errand --kind seller --output json
```

## What Errand serves for it

`GET /agent-card` on the agent returns a public JSON profile (name, description, offerings with prices, payment network, source link). It is Errand's own format, not Kite's platform-held card: Kite's card format and `card publish` flow are in its seller-agent tooling, which isn't in the public docs. If `kpass agent create --help` on your machine asks for a card, follow what it says and paste the output into this file.

## Status

Not listed yet. It needs the owner's identity check, which only the owner can do.
