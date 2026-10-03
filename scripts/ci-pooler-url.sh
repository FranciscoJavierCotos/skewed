#!/usr/bin/env bash
# Direct db.<ref>.supabase.co hosts are IPv6-only and GitHub runners have no IPv6, so a direct
# SUPABASE_DB_URL is rewritten to the Supavisor session pooler and exported via $GITHUB_ENV.
# A pooler URL passes through unchanged.
set -euo pipefail
POOLER_HOST="${POOLER_HOST:-aws-1-eu-west-3.pooler.supabase.com}"
re='^postgres(ql)?://postgres:(.+)@db\.([a-z0-9]+)\.supabase\.co:5432/(.+)$'
if [[ "$SUPABASE_DB_URL" =~ $re ]]; then
  url="postgresql://postgres.${BASH_REMATCH[3]}:${BASH_REMATCH[2]}@${POOLER_HOST}:5432/${BASH_REMATCH[4]}"
  echo "::add-mask::$url"
  echo "SUPABASE_DB_URL=$url" >> "$GITHUB_ENV"
  echo "Rewrote the direct connection URL to the session pooler."
fi
