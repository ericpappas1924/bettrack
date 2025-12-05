# 🚀 How to Deploy to Replit (IMPORTANT!)

## The Issue
If you run `git pull` but the site still shows old behavior, it's because **the frontend wasn't rebuilt**.

## ✅ Correct Deployment Steps

### In Replit Shell:

```bash
# 1. Pull latest code
git pull origin main

# 2. IMPORTANT: Rebuild the frontend
npm run build

# 3. Restart the server
# Click "Stop" button, then "Run" button
```

## Why `npm run build` is Needed

The parser code (`client/src/lib/betParser.ts`) and sport detection (`shared/betTypes.ts`) are **frontend code** that gets compiled into JavaScript bundles.

- `git pull` → Downloads new source code
- `npm run build` → Compiles TypeScript → JavaScript bundles
- Without rebuild → Old compiled code still running ❌

## Verify the Fix

After deploying, test with this NHL bet:

```
Dec-04-2025
12:48 PM	599812875	PLAYER PROPS BET
[RBL] - DST Straight|ID:371145898
Nashville Predators vs Florida Panthers
Aaron Ekblad (FLA) Over 0.5 Points
Pending		$1/$1.34
```

**Expected**: Sport should show as "NHL" ✅
**If still "NFL"**: Frontend wasn't rebuilt ❌

## Quick Test Command

Run this in Replit shell to verify the code version:

```bash
grep -A 5 "nhlFullNames" shared/betTypes.ts | head -10
```

**Should see**:
```
const nhlFullNames = [
  'BOSTON BRUINS', 'BUFFALO SABRES', 'DETROIT RED WINGS', 'FLORIDA PANTHERS',
  ...
```

If you see this, the code is updated. If parsing still fails, **run `npm run build`**!

## Alternative: Force Rebuild on Deploy

Add to `replit.nix` or run on every deploy:

```bash
git pull && npm install && npm run build && pkill node
```

This ensures:
- Latest code ✅
- Dependencies updated ✅  
- Frontend rebuilt ✅
- Server restarted ✅


