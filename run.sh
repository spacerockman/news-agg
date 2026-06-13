#!/bin/bash
# News Feed Aggregator - Quick Start
# Usage: bash ~/Desktop/news-agg/run.sh
# Or to install as background service: bash ~/Desktop/news-agg/run.sh --install

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=18180
URL="http://localhost:$PORT"

start_foreground() {
  echo "✦ Starting News Feed on $URL ..."
  node "$DIR/server.mjs"
}

start_background() {
  launchctl bootout gui/$(id -u)/com.newsfeed.server 2>/dev/null
  launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/com.newsfeed.server.plist"
  sleep 2
  echo "✦ News Feed started as background service"
  echo "   Safari: $URL"
  echo "   Logs:   $DIR/server.log"
  echo "   Stop:   launchctl bootout gui/$(id -u)/com.newsfeed.server"
}

stop() {
  launchctl bootout gui/$(id -u)/com.newsfeed.server 2>/dev/null
  pkill -f "$DIR/server.mjs" 2>/dev/null
  echo "✦ News Feed stopped"
}

status() {
  if launchctl list | grep -q com.newsfeed.server; then
    echo "✦ News Feed: running ($URL)"
  else
    echo "✦ News Feed: stopped"
  fi
}

case "${1:-start}" in
  --install) start_background ;;
  stop)      stop ;;
  status)    status ;;
  *)         start_foreground ;;
esac
