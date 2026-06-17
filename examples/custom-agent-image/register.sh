#!/usr/bin/env bash
# Register your published image as an Agent37 template, then spawn an instance from it.
#
# Prereqs:
#   - curl and jq installed
#   - your image published to a PUBLIC registry (push to main; make the GHCR package public)
#   - AGENT37_API_KEY and IMAGE_REF set (see .env.example)
set -euo pipefail

API="${AGENT37_API_BASE:-https://api.agent37.com}"
TEMPLATE="${TEMPLATE_NAME:-my-custom-agent}"
: "${AGENT37_API_KEY:?Set AGENT37_API_KEY (sk_live_...). See .env.example.}"
: "${IMAGE_REF:?Set IMAGE_REF to your published public image, e.g. ghcr.io/you/my-agent:<sha>. See .env.example.}"

echo "1/2  Registering template '${TEMPLATE}' -> ${IMAGE_REF}"
status=$(curl -sS -o /tmp/a37_template.json -w '%{http_code}' \
  -X POST "${API}/v1/templates" \
  -H "Authorization: Bearer ${AGENT37_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${TEMPLATE}\",\"image_ref\":\"${IMAGE_REF}\"}")
if [ "${status}" = "409" ]; then
  echo "     Template already exists — reusing it. (PATCH it to point at a new image.)"
elif [ "${status}" != "201" ]; then
  echo "     Failed (HTTP ${status}):" >&2; cat /tmp/a37_template.json >&2; echo >&2; exit 1
fi

echo "2/2  Creating an instance from '${TEMPLATE}'"
# topup_micros gives $1 of managed-spend headroom. It is harmless on the clean base
# (which uses no managed model) and ready if you switch to the full image.
curl -sS -X POST "${API}/v1/instances" \
  -H "Authorization: Bearer ${AGENT37_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"${TEMPLATE}\",\"budget\":{\"topup_micros\":1000000}}" \
  > /tmp/a37_instance.json

id=$(jq -r '.id // empty' /tmp/a37_instance.json)
url=$(jq -r '.ports[]? | select(.default) | .url' /tmp/a37_instance.json)
if [ -z "${id}" ]; then
  echo "Create failed:" >&2; cat /tmp/a37_instance.json >&2; echo >&2; exit 1
fi

cat <<EOF

Done. Instance ${id} is running your image.
  URL:  ${url}

Confirm your baked-in CLI shipped (control-plane exec — no model needed):
  curl -sS -X POST ${API}/v1/instances/${id}/exec \\
    -H "Authorization: Bearer \$AGENT37_API_KEY" -H "Content-Type: application/json" \\
    -d '{"command":"cowsay hello from my own image"}'

See your seeded skill:
  curl -sS -X POST ${API}/v1/instances/${id}/exec \\
    -H "Authorization: Bearer \$AGENT37_API_KEY" -H "Content-Type: application/json" \\
    -d '{"command":"ls ~/.hermes/skills"}'

Delete it when you are done (this stops billing):
  curl -sS -X DELETE ${API}/v1/instances/${id} -H "Authorization: Bearer \$AGENT37_API_KEY"
EOF
