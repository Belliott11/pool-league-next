#!/usr/bin/env bash
# Starts the Chrome DevTools MCP for Claude Code (see .mcp.json): performance traces, network and console inspection of the site.
# In Claude cloud sessions it uses the preinstalled Chromium at /opt/pw-browsers/chromium (run as root, so without the sandbox) and
# the session's proxy; anywhere else it uses the installed Chrome.
args=(--headless --isolated --viewport 390x844 --no-usage-statistics --no-performance-crux) # nothing sent to Google
if [ -x /opt/pw-browsers/chromium ]; then
  args+=(--executablePath /opt/pw-browsers/chromium --chrome-arg=--no-sandbox)
  [ -n "${HTTPS_PROXY:-}" ] && args+=(--proxyServer "$HTTPS_PROXY")
fi
exec npx -y chrome-devtools-mcp@1.12.0 "${args[@]}" "$@"
