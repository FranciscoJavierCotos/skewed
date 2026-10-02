#!/usr/bin/env bash
# Prints env vars for the local Supabase stack. Usage: bash scripts/local-supabase-env.sh > .env.local
set -euo pipefail
eval "$(${SUPABASE_BIN:-pnpm dlx supabase} status -o env 2>/dev/null)"
cat <<VARS
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${PUBLISHABLE_KEY:-$ANON_KEY}
SUPABASE_URL=$API_URL
SUPABASE_SECRET_KEY=${SECRET_KEY:-$SERVICE_ROLE_KEY}
VARS
