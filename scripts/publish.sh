#!/usr/bin/env bash
# Publish the site: push to GitHub, then trigger the Coolify deploy over the mesh.
# Requires: mesh access + Coolify API token at ~/.config/coolify/api-token.
set -euo pipefail

APP_UUID="b1j1tqtp7znszj6uwze3tsmp"
COOLIFY="http://100.78.167.128:8000"
TOKEN=$(cat ~/.config/coolify/api-token)

git push
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "$COOLIFY/api/v1/deploy?uuid=$APP_UUID" |
  python3 -c "import json,sys; print(json.load(sys.stdin)['deployments'][0]['message'])"
