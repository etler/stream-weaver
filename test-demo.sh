#!/bin/bash
npm run demo >/dev/null 2>&1 &
PID=$!
sleep 5
curl -s http://localhost:3000/counter > /tmp/counter.html
kill $PID 2>/dev/null || true
grep 'weaver.push' /tmp/counter.html
