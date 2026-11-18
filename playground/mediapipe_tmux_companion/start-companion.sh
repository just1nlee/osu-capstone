#!/bin/sh
set -e

CDPATH= cd "$(dirname "$0")"

socket=gesture-demo
session=work

if ! tmux -L "$socket" has-session -t "=$session" 2>/dev/null; then
  tmux -L "$socket" new-session -d -s "$session"
fi

unset TMUX_COMPANION_SOCKET_PATH
TMUX_COMPANION_SOCKET_NAME="$socket" nohup npm start \
  </dev/null >"${TMPDIR:-/tmp}/tmux-companion.log" 2>&1 &

exec tmux -L "$socket" attach-session -t "=$session"
