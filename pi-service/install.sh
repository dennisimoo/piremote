#!/bin/bash

# PiRemote Service Installer

set -e

echo "Installing PiRemote Service..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Install build dependencies for node-pty and bleno
apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev build-essential

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/piremote"

# Copy files to install directory
mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"

# Install npm dependencies
cd "$INSTALL_DIR"
npm install

# Create systemd service
cat > /etc/systemd/system/piremote.service << EOF
[Unit]
Description=PiRemote Service
After=network.target bluetooth.target

[Service]
Type=simple
WorkingDirectory=/opt/piremote
ExecStart=/usr/bin/node /opt/piremote/index.js
Restart=always
RestartSec=10
Environment=PIREMOTE_SERVER=https://your-server.com
Environment=PI_TOKEN=your-secret-token

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable piremote.service

echo ""
echo "Installation complete!"
echo ""
echo "IMPORTANT: Edit /etc/systemd/system/piremote.service to set:"
echo "  - PIREMOTE_SERVER: Your server URL"
echo "  - PI_TOKEN: Your secret token (must match server)"
echo ""
echo "Then run:"
echo "  sudo systemctl start piremote"
echo ""
