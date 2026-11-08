#!/usr/bin/env bash
# Demo Day run sheet as a script. Each step prints the request, runs it live,
# and shows the status and body. Press Enter to move to the next step.
#
#   ./demo.sh          the live demo, one step at a time
#   ./demo.sh check    pre-flight: runs every step without pausing, prints PASS/FAIL
#
# The API key is read without echoing, so it never shows on the projector or in
# shell history. Set BASE to point somewhere else, e.g.
#   BASE=http://localhost:5001 ./demo.sh check

set -u

BASE="${BASE:-https://find-my-artisan.onrender.com}"
MODE="${1:-live}"
ARTISAN=1       # Wanjiru Kamau, electrician, Nairobi
MISSING=99999   # an id that doesn't exist

if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; RED=$'\e[31m'; CYAN=$'\e[36m'; RESET=$'\e[0m'
else
  BOLD=; DIM=; GREEN=; RED=; CYAN=; RESET=
fi

if [ -z "${API_KEY:-}" ]; then
  printf 'API key (hidden): '
  read -rs API_KEY
  echo
fi
[ -n "$API_KEY" ] || { echo "No key given."; exit 1; }

FAILS=0
STATUS=
BODY=

# Pretty-print JSON if jq is around, otherwise print it as it came.
pretty() {
  if command -v jq >/dev/null 2>&1; then jq . 2>/dev/null <<<"$1" || echo "$1"; else echo "$1"; fi
}

# call LABEL EXPECTED_STATUS USE_KEY METHOD PATH [JSON_BODY]
# Shows the command with "$API_KEY" in place of the key, never the key itself.
call() {
  local label=$1 expect=$2 use_key=$3 method=$4 path=$5 data=${6:-}
  local shown="curl -X $method"
  local args=(-sS -X "$method" -w $'\n%{http_code}' --max-time 90)
  if [ "$use_key" = key ]; then
    args+=(-H "X-API-Key: $API_KEY"); shown+=' -H "X-API-Key: $API_KEY"'
  fi
  if [ -n "$data" ]; then
    args+=(-H 'Content-Type: application/json' -d "$data"); shown+=" -H 'Content-Type: application/json' -d '$data'"
  fi
  shown+=" $BASE$path"

  echo
  echo "${BOLD}${CYAN}== $label${RESET}"
  echo "${DIM}\$ $shown${RESET}"

  local out
  out=$(curl "${args[@]}" "$BASE$path")
  STATUS=${out##*$'\n'}
  BODY=${out%$'\n'*}

  if [ "$STATUS" = "$expect" ]; then
    echo "${GREEN}HTTP $STATUS${RESET} (expected $expect)"
  else
    echo "${RED}HTTP $STATUS${RESET} (expected $expect)"
    FAILS=$((FAILS + 1))
  fi
  [ -n "$BODY" ] && pretty "$BODY"
}

pause() {
  [ "$MODE" = check ] && return
  echo
  read -rp "${DIM}[Enter] $1${RESET}" _
}

# A two-hour slot three days from now, 10:00–12:00 Nairobi time (07:00–09:00Z),
# so it falls inside the 14-day busy window. Moves a day on if that time is taken.
day_plus() {
  date -u -v+"$1"d +%Y-%m-%d 2>/dev/null || date -u -d "+$1 days" +%Y-%m-%d
}

[ "$MODE" = check ] || clear 2>/dev/null
echo "${BOLD}Find My Artisan — live API demo${RESET}  ${DIM}($BASE)${RESET}"

# 0. Wake Render. A sleeping server takes about a minute to answer the first call.
if [ "$MODE" = check ]; then
  echo "${DIM}Waking the server (up to 90 s if it was asleep)...${RESET}"
  curl -sS -o /dev/null --max-time 90 "$BASE/artisans" || true
fi

pause "READ"

# 1. READ
call "READ: one artisan, with their verified badge and busy times" 200 key GET "/artisans/$ARTISAN"
pause "WRITE"

# 2. WRITE: mark the artisan busy, then read them again to see it saved.
BLOCK_ID=
for offset in 3 4 5 6 7; do
  d=$(day_plus "$offset")
  call "WRITE: mark the artisan busy on $d, 10:00–12:00 Nairobi time" 201 key POST \
    "/artisans/$ARTISAN/availability" "{\"start\":\"${d}T07:00:00Z\",\"end\":\"${d}T09:00:00Z\"}"
  if [ "$STATUS" = 201 ]; then
    BLOCK_ID=$(jq -r .id <<<"$BODY" 2>/dev/null || sed -E 's/.*"id":([0-9]+).*/\1/' <<<"$BODY")
    break
  fi
  # Only an overlap is worth retrying on another day.
  grep -q overlaps <<<"$BODY" || break
  [ "$offset" -lt 7 ] && FAILS=$((FAILS - 1))
done
pause "show it saved"

call "WRITE (proof): the new time is now in the artisan's busy list" 200 key GET "/artisans/$ARTISAN"
pause "FAIL: no key"

# 3. FAILURES
call "FAIL: same request with no API key, so the Week 9 check refuses it" 401 none GET "/artisans/$ARTISAN"
pause "FAIL: missing id"

call "FAIL: an artisan id that doesn't exist" 404 key GET "/artisans/$MISSING"
pause "FAIL: review without a job"

call "FAIL: a review for an artisan this key never hired" 403 key POST \
  "/artisans/$ARTISAN/reviews" '{"author":"Demo Day","rating":5}'
# If this key has logged a job with the artisan, the review is accepted. Remove
# it straight away so no fake review stays on the live site.
if [ "$STATUS" = 201 ]; then
  REVIEW_ID=$(jq -r .id <<<"$BODY" 2>/dev/null)
  echo "${RED}This key has a logged job with artisan $ARTISAN, so the review went in. Removing it.${RESET}"
  [ -n "$REVIEW_ID" ] && call "CLEAN UP: delete that review" 204 key DELETE "/artisans/$ARTISAN/reviews/$REVIEW_ID"
fi
pause "MONITOR: /stats"

# 4. MONITOR
call "MONITOR: live numbers since the server last started" 200 key GET "/stats"
pause "clean up"

# 5. Clean up so the demo leaves no fake busy time behind.
if [ -n "$BLOCK_ID" ]; then
  call "CLEAN UP: delete the busy time we just made" 204 key DELETE "/artisans/$ARTISAN/availability/$BLOCK_ID"
fi

echo
if [ "$FAILS" -eq 0 ]; then
  echo "${GREEN}${BOLD}PASS${RESET}: every step answered as expected."
else
  echo "${RED}${BOLD}FAIL${RESET}: $FAILS step(s) answered differently. Read the red lines above."
fi
[ "$MODE" = check ] && exit "$FAILS"
exit 0
