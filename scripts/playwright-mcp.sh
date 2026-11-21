#!/usr/bin/env bash
# Starts the Playwright browser MCP for Claude Code (see .mcp.json).
# In Claude cloud sessions a Chromium is preinstalled at /opt/pw-browsers/chromium;
# use it there (it runs as root, so without the sandbox). Anywhere else Playwright uses its own browser.
args=(--headless --isolated --viewport-size 1280x800)
if [ -x /opt/pw-browsers/chromium ]; then
  args+=(--executable-path /opt/pw-browsers/chromium --no-sandbox)
fi
exec npx -y @playwright/mcp@0.0.84 "${args[@]}" "$@"
