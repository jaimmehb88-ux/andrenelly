#!/usr/bin/env bash
set -euo pipefail
# Reuse an existing display; start only a private local screen when needed.
if [[ -n "${DISPLAY:-}" ]]; then exit 0; fi
if DISPLAY=:99 xdpyinfo >/dev/null 2>&1; then exit 0; fi
command -v Xorg >/dev/null
cat > /tmp/sath-cloud-xorg.conf <<'CONFIG'
Section "Device"
 Identifier "DummyDevice"
 Driver "dummy"
 VideoRam 256000
EndSection
Section "Monitor"
 Identifier "DummyMonitor"
 HorizSync 5.0-1000.0
 VertRefresh 5.0-200.0
 Modeline "1600x1000" 133.00 1600 1696 1856 2112 1000 1003 1009 1037
EndSection
Section "Screen"
 Identifier "DummyScreen"
 Device "DummyDevice"
 Monitor "DummyMonitor"
 DefaultDepth 24
 SubSection "Display"
  Depth 24
  Modes "1600x1000"
 EndSubSection
EndSection
Section "ServerFlags"
 Option "AutoAddDevices" "false"
 Option "AutoAddGPU" "false"
EndSection
CONFIG
nohup Xorg :99 -config /tmp/sath-cloud-xorg.conf -logfile /tmp/sath-cloud-xorg.log -noreset -nolisten tcp >/tmp/sath-cloud-display.log 2>&1 &
echo "$!" > /tmp/sath-cloud-display.pid
for attempt in {1..30}; do
  if DISPLAY=:99 xdpyinfo >/dev/null 2>&1; then exit 0; fi
  sleep .2
done
echo 'No se pudo iniciar la pantalla. Revisa /tmp/sath-cloud-display.log.' >&2
exit 1
