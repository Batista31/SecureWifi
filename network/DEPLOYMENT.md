# Raspberry Pi Deployment Guide
# Secure Public Wi-Fi Access System with Captive Portal

This guide provides step-by-step instructions for deploying the captive portal system on a Raspberry Pi.

## Table of Contents

1. [Hardware Requirements](#hardware-requirements)
2. [Software Prerequisites](#software-prerequisites)
3. [System Preparation](#system-preparation)
4. [Installation Steps](#installation-steps)
5. [Configuration](#configuration)
6. [Starting the System](#starting-the-system)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)

---

## Hardware Requirements

### Minimum Requirements

- **Raspberry Pi**: Model 3B+, 4, or 5 (recommended: Pi 4 with 4GB RAM)
- **MicroSD Card**: 16GB or larger (Class 10 recommended)
- **Power Supply**: Official Raspberry Pi power supply
- **WiFi Adapter**: Built-in or USB WiFi adapter that supports AP mode
- **Ethernet Cable**: For WAN connection (internet uplink)

### Recommended Setup

```
Internet Router
      │
      │ Ethernet (eth0)
      ▼
┌─────────────────┐
│  Raspberry Pi   │
│                 │
│  wlan0 (AP)     │──── WiFi Clients
│  192.168.4.1    │     (Captive Portal Users)
└─────────────────┘
```

---

## Software Prerequisites

### Operating System

- Raspberry Pi OS Lite (64-bit recommended)
- Debian 11 (Bullseye) or newer

### Required Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
    hostapd \
    dnsmasq \
    iptables \
    ebtables \
    conntrack \
    bridge-utils \
    nodejs \
    npm \
    git \
    curl \
    wireless-tools \
    iw
```

### Node.js Version

Ensure Node.js 18.x or newer is installed:

```bash
# Check version
node --version

# If outdated, install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## System Preparation

### 1. Check WiFi Interface

Verify your WiFi interface supports AP mode:

```bash
# List wireless interfaces
iw dev

# Check AP mode support
iw list | grep -A 10 "Supported interface modes"
```

Look for `AP` in the supported modes list.

### 2. Disable Conflicting Services

```bash
# Stop and disable NetworkManager (if installed)
sudo systemctl stop NetworkManager
sudo systemctl disable NetworkManager

# Prevent dhcpcd from managing wlan0
echo "denyinterface wlan0" | sudo tee -a /etc/dhcpcd.conf
sudo systemctl restart dhcpcd

# Stop wpa_supplicant for wlan0
sudo systemctl stop wpa_supplicant
```

### 3. Create Required Directories

```bash
sudo mkdir -p /opt/captive-portal
sudo mkdir -p /var/log/captive-portal
sudo mkdir -p /var/run/captive-portal
```

---

## Installation Steps

### 1. Clone/Copy Project Files

```bash
# Option 1: Clone from repository
cd /opt/captive-portal
sudo git clone <repository-url> .

# Option 2: Copy from local machine
# Use SCP or USB to transfer files to /opt/captive-portal
```

### 2. Install Backend Dependencies

```bash
cd /opt/captive-portal/backend
sudo npm install --production
```

### 3. Build Dashboard

```bash
cd /opt/captive-portal/dashboard
sudo npm install
sudo npm run build

# Install serve for production
sudo npm install -g serve
```

### 4. Copy Configuration Files

```bash
# hostapd configuration
sudo cp /opt/captive-portal/network/hostapd.conf /etc/hostapd/hostapd.conf

# dnsmasq configuration
sudo cp /opt/captive-portal/network/dnsmasq.conf /etc/dnsmasq.conf
sudo cp /opt/captive-portal/network/dnsmasq.hosts /etc/dnsmasq.hosts

# Set hostapd config path
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' | sudo tee /etc/default/hostapd
```

### 5. Install Scripts

```bash
# Make scripts executable
sudo chmod +x /opt/captive-portal/network/scripts/*.sh

# Create symlinks for convenience
sudo ln -sf /opt/captive-portal/network/scripts/firewall.sh /usr/local/bin/captive-firewall
sudo ln -sf /opt/captive-portal/network/scripts/client-isolation.sh /usr/local/bin/captive-isolation
```

### 6. Install Systemd Services

```bash
# Copy service files
sudo cp /opt/captive-portal/network/systemd/*.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable hostapd
sudo systemctl enable dnsmasq
sudo systemctl enable captive-portal-network
sudo systemctl enable captive-portal-firewall
sudo systemctl enable captive-portal-isolation
sudo systemctl enable captive-portal
sudo systemctl enable captive-portal-dashboard
```

---

## Configuration

### 1. WiFi Settings

Edit `/etc/hostapd/hostapd.conf`:

```bash
sudo nano /etc/hostapd/hostapd.conf
```

Key settings to modify:

```ini
# Change WiFi name
ssid=YourNetworkName

# Change password (must be 8+ characters)
wpa_passphrase=YourSecurePassword

# Change channel if needed
channel=7

# For 5GHz (if supported)
# hw_mode=a
# channel=36
```

### 2. Network Settings

Edit `/etc/dnsmasq.conf` if you need different IP ranges:

```ini
# Default: 192.168.4.0/24
dhcp-range=192.168.4.2,192.168.4.254,255.255.255.0,24h
```

### 3. Backend Configuration

Edit `/etc/systemd/system/captive-portal.service`:

```ini
# Change JWT secret (IMPORTANT for security!)
Environment=JWT_SECRET=your-unique-secret-key-here

# For actual firewall control (not simulation)
Environment=SIMULATION_MODE=false
```

### 4. Generate New JWT Secret

```bash
# Generate a secure random secret
openssl rand -hex 32
```

---

## Starting the System

### Manual Start (for testing)

```bash
# Start in order
sudo systemctl start hostapd
sudo systemctl start dnsmasq
sudo systemctl start captive-portal-network
sudo systemctl start captive-portal-firewall
sudo systemctl start captive-portal-isolation
sudo systemctl start captive-portal
sudo systemctl start captive-portal-dashboard
```

### Automatic Start (recommended)

```bash
# Reboot to start all services automatically
sudo reboot
```

### Check Status

```bash
# Check all services
sudo systemctl status hostapd
sudo systemctl status dnsmasq
sudo systemctl status captive-portal
sudo systemctl status captive-portal-dashboard

# Quick status check
for svc in hostapd dnsmasq captive-portal captive-portal-dashboard; do
    echo "$svc: $(systemctl is-active $svc)"
done
```

---

## Verification

### 1. Verify WiFi Access Point

```bash
# Check if AP is broadcasting
iwconfig wlan0

# Check connected clients
iw dev wlan0 station dump
```

### 2. Verify DHCP

```bash
# Check DHCP leases
cat /var/lib/misc/dnsmasq.leases

# Check dnsmasq logs
sudo journalctl -u dnsmasq -f
```

### 3. Verify Captive Portal

```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Check portal page
curl http://localhost:3000/

# Check dashboard
curl http://localhost:5173/
```

### 4. Test Client Connection

1. Connect a device to the WiFi network
2. Open a browser - should redirect to captive portal
3. Register or use voucher code
4. Verify internet access after authentication

### 5. Verify Firewall Rules

```bash
# Check iptables rules
sudo iptables -L -n -v
sudo iptables -t nat -L -n -v

# Check ebtables (client isolation)
sudo ebtables -L --Lc

# Use firewall script
sudo /usr/local/bin/captive-firewall status
```

---

## Troubleshooting

### WiFi AP Not Starting

```bash
# Check hostapd logs
sudo journalctl -u hostapd -b

# Common issues:
# - Interface already in use: sudo rfkill unblock wifi
# - Driver issues: Try USB WiFi adapter with nl80211 support
# - Channel issues: Try different channel
```

### No DHCP Addresses

```bash
# Check dnsmasq
sudo journalctl -u dnsmasq -b

# Verify interface has IP
ip addr show wlan0

# Manual IP assignment test
sudo dnsmasq --test
```

### Captive Portal Not Redirecting

```bash
# Check NAT rules
sudo iptables -t nat -L CAPTIVE_PORTAL -n -v

# Check if DNS hijacking works
nslookup connectivitycheck.gstatic.com 192.168.4.1

# Check backend logs
sudo journalctl -u captive-portal -f
```

### Clients Can't Access Internet After Auth

```bash
# Check if device is in allowed list
sudo /usr/local/bin/captive-firewall list

# Check forwarding
cat /proc/sys/net/ipv4/ip_forward  # Should be 1

# Check NAT
sudo iptables -t nat -L POSTROUTING -n -v

# Manual allow (for testing)
sudo /usr/local/bin/captive-firewall allow AA:BB:CC:DD:EE:FF 192.168.4.100
```

### View All Logs

```bash
# All captive portal logs
sudo journalctl -u 'captive-portal*' -f

# Combined with hostapd and dnsmasq
sudo journalctl -u hostapd -u dnsmasq -u captive-portal -f
```

---

## Security Considerations

### 1. Change Default Credentials

```bash
# Change admin password in database
cd /opt/captive-portal/backend
node -e "
const db = require('better-sqlite3')('database/captive_portal.db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('YOUR_NEW_PASSWORD', 10);
db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, 'admin');
console.log('Password updated');
"
```

### 2. Use Strong WiFi Password

- Minimum 12 characters
- Mix of letters, numbers, symbols
- Avoid dictionary words

### 3. Enable HTTPS (Recommended)

For production, set up nginx with SSL:

```bash
sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx as reverse proxy with SSL
```

### 4. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd /opt/captive-portal/backend && npm update
cd /opt/captive-portal/dashboard && npm update
```

### 5. Backup Database

```bash
# Create backup script
cat << 'EOF' | sudo tee /opt/captive-portal/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/captive-portal/backups"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)
cp /opt/captive-portal/backend/database/captive_portal.db "$BACKUP_DIR/backup_$DATE.db"
# Keep only last 7 backups
ls -t "$BACKUP_DIR"/*.db | tail -n +8 | xargs -r rm
EOF

sudo chmod +x /opt/captive-portal/backup.sh

# Add to crontab
echo "0 2 * * * /opt/captive-portal/backup.sh" | sudo crontab -
```

---

## Quick Reference

### Service Commands

```bash
# Start all
sudo systemctl start hostapd dnsmasq captive-portal captive-portal-dashboard

# Stop all
sudo systemctl stop captive-portal-dashboard captive-portal dnsmasq hostapd

# Restart all
sudo systemctl restart hostapd dnsmasq captive-portal captive-portal-dashboard

# View logs
sudo journalctl -u captive-portal -f
```

### Firewall Commands

```bash
# Allow device
sudo captive-firewall allow AA:BB:CC:DD:EE:FF 192.168.4.100

# Block device
sudo captive-firewall block AA:BB:CC:DD:EE:FF 192.168.4.100

# List allowed
sudo captive-firewall list

# Show status
sudo captive-firewall status
```

### Network Addresses

| Service | Address |
|---------|---------|
| Gateway/Portal IP | 192.168.4.1 |
| DHCP Range | 192.168.4.2 - 192.168.4.254 |
| Captive Portal | http://192.168.4.1:3000 |
| Admin Dashboard | http://192.168.4.1:5173 |

### Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| WiFi Network | - | CaptivePortal123 |
| Admin Dashboard | admin | admin123 |

**⚠️ Change these in production!**

---

## Support

For issues and questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs: `sudo journalctl -u captive-portal -b`
3. Open an issue on the project repository

---

*Document Version: 1.0.0*  
*Last Updated: 2024*
