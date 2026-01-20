#!/bin/bash
# ==============================================================================
# Quick Install Script for Captive Portal on Raspberry Pi
# ==============================================================================
# This script automates the installation process on a fresh Raspberry Pi OS.
#
# Usage: sudo ./install.sh
#
# Author: Captive Portal Team
# Version: 1.0.0
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/captive-portal"
WLAN_INTERFACE="wlan0"
WIFI_SSID="SecureWiFi"
WIFI_PASSWORD="CaptivePortal123"
PORTAL_IP="192.168.4.1"

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     Secure WiFi Captive Portal - Installation Script       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_raspberry_pi() {
    if [[ ! -f /proc/device-tree/model ]]; then
        print_warning "This doesn't appear to be a Raspberry Pi"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo "Detected: $(cat /proc/device-tree/model)"
    fi
}

check_wifi_interface() {
    if ! ip link show "$WLAN_INTERFACE" &>/dev/null; then
        print_error "WiFi interface $WLAN_INTERFACE not found"
        echo "Available interfaces:"
        ip link show | grep -E "^[0-9]+" | awk '{print $2}' | tr -d ':'
        exit 1
    fi
    
    # Check AP mode support
    if ! iw list 2>/dev/null | grep -q "AP"; then
        print_warning "WiFi adapter may not support AP mode"
    fi
}

# ==============================================================================
# Installation Functions
# ==============================================================================

install_packages() {
    print_step "Installing required packages..."
    
    apt update
    apt install -y \
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
        iw \
        usbmuxd \
        ipheth-utils \
        libimobiledevice-utils
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 16 ]]; then
        print_step "Upgrading Node.js to v18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt install -y nodejs
    fi
    
    print_success "Packages installed"
}

create_directories() {
    print_step "Creating directories..."
    
    mkdir -p "$INSTALL_DIR"
    mkdir -p /var/log/captive-portal
    mkdir -p /var/run/captive-portal
    
    print_success "Directories created"
}

copy_project_files() {
    print_step "Copying project files..."
    
    # Assuming script is run from project directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    if [[ -d "$PROJECT_DIR/backend" ]]; then
        cp -r "$PROJECT_DIR/backend" "$INSTALL_DIR/"
        # Copy and patch package.json for the backend service
        cp "$PROJECT_DIR/package.json" "$INSTALL_DIR/backend/"
        sed -i 's|backend/src/|src/|g' "$INSTALL_DIR/backend/package.json"

        cp -r "$PROJECT_DIR/dashboard" "$INSTALL_DIR/"
        cp -r "$PROJECT_DIR/network" "$INSTALL_DIR/"
        print_success "Project files copied to $INSTALL_DIR"
    else
        print_error "Cannot find project files. Please copy manually to $INSTALL_DIR"
        exit 1
    fi
}

install_dependencies() {
    print_step "Installing backend dependencies..."
    cd "$INSTALL_DIR/backend"
    npm install --production
    
    print_step "Building dashboard..."
    cd "$INSTALL_DIR/dashboard"
    npm install
    npm run build
    
    # Install serve globally for production
    npm install -g serve
    
    print_success "Dependencies installed"
}

configure_hostapd() {
    print_step "Configuring hostapd..."
    
    cp "$INSTALL_DIR/network/hostapd.conf" /etc/hostapd/hostapd.conf
    
    # Update WiFi credentials
    sed -i "s/^ssid=.*/ssid=$WIFI_SSID/" /etc/hostapd/hostapd.conf
    sed -i "s/^wpa_passphrase=.*/wpa_passphrase=$WIFI_PASSWORD/" /etc/hostapd/hostapd.conf
    
    # Set config path
    echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' > /etc/default/hostapd
    
    # Unmask and enable
    systemctl unmask hostapd
    
    print_success "hostapd configured"
}

configure_dnsmasq() {
    print_step "Configuring dnsmasq..."
    
    # Backup original
    if [[ -f /etc/dnsmasq.conf ]]; then
        mv /etc/dnsmasq.conf /etc/dnsmasq.conf.backup
    fi
    
    cp "$INSTALL_DIR/network/dnsmasq.conf" /etc/dnsmasq.conf
    cp "$INSTALL_DIR/network/dnsmasq.hosts" /etc/dnsmasq.hosts
    
    print_success "dnsmasq configured"
}

configure_network() {
    print_step "Configuring network..."
    
    # Prevent dhcpcd from managing wlan0
    if ! grep -q "denyinterface $WLAN_INTERFACE" /etc/dhcpcd.conf 2>/dev/null; then
        echo "denyinterface $WLAN_INTERFACE" >> /etc/dhcpcd.conf
    fi
    
    # Enable IP forwarding
    if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf; then
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    fi
    sysctl -p
    
    print_success "Network configured"
}

install_scripts() {
    print_step "Installing scripts..."
    
    chmod +x "$INSTALL_DIR/network/scripts/"*.sh
    
    ln -sf "$INSTALL_DIR/network/scripts/firewall.sh" /usr/local/bin/captive-firewall
    ln -sf "$INSTALL_DIR/network/scripts/client-isolation.sh" /usr/local/bin/captive-isolation
    ln -sf "$INSTALL_DIR/network/scripts/setup-network.sh" /usr/local/bin/captive-network
    
    print_success "Scripts installed"
}

install_services() {
    print_step "Installing systemd services..."
    
    cp "$INSTALL_DIR/network/systemd/"*.service /etc/systemd/system/
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" \
        /etc/systemd/system/captive-portal.service
    
    systemctl daemon-reload
    
    # Enable services
    systemctl enable hostapd
    systemctl enable dnsmasq
    systemctl enable captive-portal-network
    systemctl enable captive-portal-firewall
    systemctl enable captive-portal-isolation
    systemctl enable captive-portal
    systemctl enable captive-portal-dashboard
    
    print_success "Services installed and enabled"
}

print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Installation Complete!                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "WiFi Network Configuration:"
    echo "  SSID:     $WIFI_SSID"
    echo "  Password: $WIFI_PASSWORD"
    echo ""
    echo "Network Addresses:"
    echo "  Gateway IP:      $PORTAL_IP"
    echo "  Captive Portal:  http://$PORTAL_IP:3000"
    echo "  Admin Dashboard: http://$PORTAL_IP:5173"
    echo ""
    echo "Default Admin Login:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Change default passwords before production use!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Review configuration files in $INSTALL_DIR/network/"
    echo "  2. Reboot to start all services: sudo reboot"
    echo "  3. Connect to '$WIFI_SSID' and test the captive portal"
    echo ""
    echo "For troubleshooting, see: $INSTALL_DIR/network/DEPLOYMENT.md"
    echo ""
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    print_header
    
    check_root
    check_raspberry_pi
    check_wifi_interface
    
    echo ""
    echo "This script will install the Captive Portal system."
    echo "WiFi Interface: $WLAN_INTERFACE"
    echo ""
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    echo ""
    
    install_packages
    create_directories
    copy_project_files
    install_dependencies
    configure_hostapd
    configure_dnsmasq
    configure_network
    install_scripts
    install_services
    
    print_summary
}

main "$@"
