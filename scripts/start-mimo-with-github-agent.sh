#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(dirname -- "$SCRIPT_DIR")"
USER_HOME="${HOME:-}"
SSH_KEY_PATH="${GITHUB_SSH_KEY:-$USER_HOME/.ssh/github-anomaly-alpha}"
SSH_HOST_ALIAS="${GITHUB_SSH_HOST:-github-anomaly-alpha}"
MIMO_BIN="${MIMO_BIN:-mimo}"
AGENT_STARTED=0

cleanup() {
  if [ "$AGENT_STARTED" -eq 1 ]; then
    ssh-agent -k >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if [ ! -f "$SSH_KEY_PATH" ]; then
  printf 'SSH key not found: %s\n' "$SSH_KEY_PATH" >&2
  exit 1
fi

agent_status=0
if [ -n "${SSH_AUTH_SOCK:-}" ]; then
  ssh-add -l >/dev/null 2>&1 || agent_status=$?
else
  agent_status=2
fi

if [ "$agent_status" -eq 2 ]; then
  eval "$(ssh-agent -s)" >/dev/null
  AGENT_STARTED=1
elif [ "$agent_status" -gt 2 ]; then
  printf 'Unable to inspect SSH agent.\n' >&2
  exit 1
fi

key_fingerprint="$(ssh-keygen -lf "$SSH_KEY_PATH" | awk '{print $2}')"
if ! ssh-add -l 2>/dev/null | awk '{print $2}' | grep -Fqx "$key_fingerprint"; then
  ssh-add "$SSH_KEY_PATH"
fi

ssh_result="$(ssh -T "git@$SSH_HOST_ALIAS" 2>&1 || true)"
if [[ "$ssh_result" != *"successfully authenticated"* ]]; then
  printf '%s\n' "$ssh_result" >&2
  printf 'GitHub SSH authentication failed for host alias: %s\n' "$SSH_HOST_ALIAS" >&2
  exit 1
fi

git -C "$REPO_DIR" ls-remote origin HEAD >/dev/null

if ! command -v "$MIMO_BIN" >/dev/null 2>&1; then
  printf 'MiMoCode command not found: %s\n' "$MIMO_BIN" >&2
  exit 1
fi

cd "$REPO_DIR"
printf 'SSH agent ready; launching MiMoCode from %s\n' "$REPO_DIR"
"$MIMO_BIN" "$@"
