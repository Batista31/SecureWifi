# 🍓 Deploying on Raspberry Pi

This guide explains how to turn your Raspberry Pi into a **Secure Wi-Fi Captive Portal** using the provided software suite.

## 📋 Prerequisites

- **Hardware**: Raspberry Pi 3B+, 4B, or 5.
- **OS**: Raspberry Pi OS (Standard or Lite), 64-bit recommended.
- **Internet Access**: The Pi needs internet access (via Ethernet or a secondary WiFi dongle) during installation to download dependencies.
- **Storage**: MicroSD card (8GB+).

## � Using Mobile Hotspot (Internet Access)

If you don't have a wired Ethernet connection, you can use your phone's internet (Mobile Hotspot) to provide internet to the Raspberry Pi.

### Method: USB Tethering (Recommended)
This acts like a wired connection and works perfectly with the Captive Portal.

1.  Connect your phone to the Raspberry Pi using a USB cable.
2.  Enable **USB Tethering** on your phone (usually in Settings > Connections > Mobile Hotspot and Tethering).
3.  The Pi will detect this as a network interface (usually `usb0` or `eth1`).
4.  The system is pre-configured to automatically route traffic through this interface if available.

> **Note:** Do NOT try to connect the Pi's built-in WiFi (`wlan0`) to your hotspot wirelessly. `wlan0` is already busy creating the "SecureWiFi" access point and cannot do both at the same time.

### ⚠️ Troubleshooting USB Tethering (Phone Charging but not Tethering)

If the **"USB Tethering"** option on your phone is grayed out or the Pi doesn't see the connection:

1.  **Check your USB Cable (Most Common Issue)**:
    - Many USB cables are **"Charge Only"**. They have no data wires.
    - Try a different cable (preferably the original one that came with the phone).
    - **Test:** Connect your phone to a laptop. If you can transfer files, the cable is good. If it only charges, the cable is bad.

2.  **For iPhone Users:**
    - You must trust the computer. When you plug in, unlock your phone and tap **"Trust This Computer"** when prompted.
    - The installation script now includes `usbmuxd` which is required for iPhone tethering. If you installed before this update, run `sudo apt install usbmuxd ipheth-utils`.

3.  **For Android Users:**
    - Some carriers disable tethering.
    - Go to **Settings > System > Developer Options**. (Enable Developer Options by tapping "Build Number" 7 times in "About Phone").
    - Secure "Default USB Configuration" is set to "USB Tethering" if available.

## �🚀 Quick Start Guide

### Step 1: Transfer Files to Raspberry Pi

You need to move the entire project folder to your Raspberry Pi.

**Option A: Using SCP (Network)**
If your Pi is on the same network (e.g., connected via Ethernet), run this command from your computer's terminal:

```bash
# Replace 'pi' and 'raspberrypi.local' with your actual username and hostname/IP
scp -r "d:\EL 5\EL_5" pi@raspberrypi.local:~/wifi-captive-portal
```

**Option B: Using USB Drive**
1. Copy the `EL_5` folder to a USB drive.
2. Plug the drive into the Raspberry Pi.
3. Mount it and copy the folder to your home directory.

### Step 2: Run the Installation Script

SSH into your Raspberry Pi or open a terminal on it:

```bash
ssh pi@raspberrypi.local
```

Navigate to the project directory and run the installer:

```bash
cd ~/wifi-captive-portal
cd network

# Make the script executable
chmod +x install.sh

# Run the installer (requires root)
sudo ./install.sh
```

### Step 3: Follow the Interactive Installer

1. The script will check for required hardware (WiFi interface).
2. It will ask for confirmation to proceed.
3. It will automatically:
   - Install `hostapd`, `dnsmasq`, `nodejs`, `iptables`, etc.
   - Configure the WiFi Access Point (`SecureWiFi`).
   - Set up the DHCP server and DNS hijacking.
   - Install the Backend and Dashboard.
   - Configure Systemd services to start everything on boot.

### Step 4: Reboot

Once the installation confirms success:

```bash
sudo reboot
```

## 🔌 Connecting & Testing

1. **Find the Network**: On your phone or laptop, look for the WiFi network **"SecureWiFi"**.
2. **Connect**: Use the password **`CaptivePortal123`** (default).
3. **Portal Redirect**:
   - Your device should automatically detect the captive portal.
   - If not, try visiting any HTTP website (e.g., `http://example.com`), and you should be redirected to the login page.
4. **Login**:
   - **Voucher**: `TEST1234`
   - **User Login**: Register a new account or use default credentials.

## 🛠️ Management

### Admin Dashboard
Access the admin panel to manage users, vouchers, and settings:
- **URL**: `http://192.168.4.1:5173`
- **Username**: `admin`
- **Password**: `admin123`

### Check Service Status
If something isn't working, check the service logs on the Pi:

```bash
# Check all services
systemctl status captive-portal*

# Check specific logs
journalctl -u captive-portal -f       # Backend logs
journalctl -u hostapd -f              # WiFi AP logs
journalctl -u dnsmasq -f              # DHCP/DNS logs
```

## ⚙️ Customization

### Changing WiFi Name/Password
Edit `/etc/hostapd/hostapd.conf`:
```conf
ssid=MyNewWiFi
wpa_passphrase=MyNewSecretPassword
```
Then restart hostapd: `sudo systemctl restart hostapd`

### Changing Portal IP
If you change the IP structure, you must update:
1. `/etc/dnsmasq.conf`
2. `/etc/network/interfaces` (or dhcpcd.conf)
3. `.env` file in `/opt/captive-portal/backend/.env`

## 🐛 Troubleshooting

**Issue: "I cannot connect to the WiFi"**
- Check if `hostapd` is running: `sudo systemctl status hostapd`
- Ensure your power supply is sufficient for the Pi.

**Issue: "The portal page doesn't load"**
- Check if the backend is running: `sudo systemctl status captive-portal`
- Verify DNS hijacking: `nslookup google.com 192.168.4.1` should return `192.168.4.1`.

**Issue: "I am connected but have no internet after login"**
- The Pi must have its own internet connection (e.g., Ethernet `eth0`) to route traffic.
- Check IP forwarding: `sysctl net.ipv4.ip_forward` should be `1`.
