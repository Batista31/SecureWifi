#!/bin/bash
# ==============================================================================
# Network Setup Script for Captive Portal
# ==============================================================================
# This script configures the Raspberry Pi network interfaces, enables IP
# forwarding, and sets up NAT rules for the captive portal system.
#
# Usage: sudo ./setup-network.sh [interface]
#   interface: WiFi interface name (default: wlan0)
#
# Author: Captive Portal Team
# Version: 1.0.0
# ==============================================================================

set -e

# ==============================================================================
# Configuration
# ==============================================================================

# WiFi interface (can be overridden by command line argument)
WLAN_INTERFACE="${1:-wlan0}"

# Network configuration
PORTAL_IP="192.168.4.1"
PORTAL_NETMASK="255.255.255.0"
PORTAL_NETWORK="192.168.4.0/24"
PORTAL_PORT="3000"

# Upstream interface (usually eth0 for wired or wlan1 for another WiFi)
WAN_INTERFACE="eth0"

# Log file
LOG_FILE="/var/log/captive-portal/setup.log"

# ==============================================================================
# Helper Functions
# ==============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true
}

info() {
    log "INFO" "$@"
}

warn() {
    log "WARN" "$@"
}

error() {
    log "ERROR" "$@"
    exit 1
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

check_interface() {
    if ! ip link show "$1" &>/dev/null; then
        error "Interface $1 does not exist"
    fi
}

# ==============================================================================
# Network Configuration Functions
# ==============================================================================

setup_directories() {
    info "Creating required directories..."
    mkdir -p /var/log/captive-portal
    mkdir -p /var/run/captive-portal
    chmod 755 /var/log/captive-portal
    chmod 755 /var/run/captive-portal
}

stop_conflicting_services() {
    info "Stopping conflicting services..."
    
    # Stop NetworkManager if running (it can interfere with hostapd)
    if systemctl is-active --quiet NetworkManager 2>/dev/null; then
        warn "Stopping NetworkManager..."
        systemctl stop NetworkManager
    fi
    
    # Stop dhcpcd if running on the WiFi interface
    if systemctl is-active --quiet dhcpcd 2>/dev/null; then
        warn "Configuring dhcpcd to ignore $WLAN_INTERFACE..."
        # Add interface to dhcpcd denylist
        if ! grep -q "denyinterface $WLAN_INTERFACE" /etc/dhcpcd.conf 2>/dev/null; then
            echo "denyinterface $WLAN_INTERFACE" >> /etc/dhcpcd.conf
        fi
        systemctl restart dhcpcd
    fi
    
    # Stop wpa_supplicant for this interface
    if pgrep -f "wpa_supplicant.*$WLAN_INTERFACE" &>/dev/null; then
        warn "Stopping wpa_supplicant for $WLAN_INTERFACE..."
        pkill -f "wpa_supplicant.*$WLAN_INTERFACE" || true
    fi
}

configure_interface() {
    info "Configuring interface $WLAN_INTERFACE..."
    
    # Bring interface down
    ip link set "$WLAN_INTERFACE" down 2>/dev/null || true
    
    # Flush existing IP addresses
    ip addr flush dev "$WLAN_INTERFACE" 2>/dev/null || true
    
    # Set static IP
    ip addr add "$PORTAL_IP/$PORTAL_NETMASK" dev "$WLAN_INTERFACE"
    
    # Bring interface up
    ip link set "$WLAN_INTERFACE" up
    
    info "Interface $WLAN_INTERFACE configured with IP $PORTAL_IP"
}

enable_ip_forwarding() {
    info "Enabling IP forwarding..."
    
    # Enable IPv4 forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward
    
    # Make it persistent
    if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf 2>/dev/null; then
        echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
    fi
    
    # Apply sysctl settings
    sysctl -p /etc/sysctl.conf &>/dev/null || true
    
    info "IP forwarding enabled"
}

setup_iptables_nat() {
    info "Setting up NAT rules..."
    
    # Clear existing NAT rules
    iptables -t nat -F PREROUTING 2>/dev/null || true
    iptables -t nat -F POSTROUTING 2>/dev/null || true
    
    # Enable masquerading for outbound traffic
    iptables -t nat -A POSTROUTING -o "$WAN_INTERFACE" -j MASQUERADE
    
    info "NAT configured for outbound traffic via $WAN_INTERFACE"
}

setup_captive_portal_redirect() {
    info "Setting up captive portal redirect rules..."
    
    # Create custom chain for captive portal
    iptables -t nat -N CAPTIVE_PORTAL 2>/dev/null || iptables -t nat -F CAPTIVE_PORTAL
    
    # Redirect all HTTP traffic to captive portal
    iptables -t nat -A CAPTIVE_PORTAL -p tcp --dport 80 -j DNAT --to-destination "$PORTAL_IP:$PORTAL_PORT"
    
    # Redirect common captive portal detection URLs
    # Apple
    iptables -t nat -A CAPTIVE_PORTAL -p tcp -d 17.0.0.0/8 --dport 80 -j DNAT --to-destination "$PORTAL_IP:$PORTAL_PORT"
    # Google
    iptables -t nat -A CAPTIVE_PORTAL -p tcp -d 172.217.0.0/16 --dport 80 -j DNAT --to-destination "$PORTAL_IP:$PORTAL_PORT"
    iptables -t nat -A CAPTIVE_PORTAL -p tcp -d 142.250.0.0/16 --dport 80 -j DNAT --to-destination "$PORTAL_IP:$PORTAL_PORT"
    # Microsoft
    iptables -t nat -A CAPTIVE_PORTAL -p tcp -d 13.107.0.0/16 --dport 80 -j DNAT --to-destination "$PORTAL_IP:$PORTAL_PORT"
    
    # Apply to incoming traffic on WiFi interface
    iptables -t nat -A PREROUTING -i "$WLAN_INTERFACE" -j CAPTIVE_PORTAL
    
    info "Captive portal redirect configured"
}

setup_firewall_rules() {
    info "Setting up firewall rules..."
    
    # Create custom chains
    iptables -N CAPTIVE_FW 2>/dev/null || iptables -F CAPTIVE_FW
    
    # Allow established connections
    iptables -A CAPTIVE_FW -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    # Allow DNS (port 53)
    iptables -A CAPTIVE_FW -p udp --dport 53 -j ACCEPT
    iptables -A CAPTIVE_FW -p tcp --dport 53 -j ACCEPT
    
    # Allow DHCP (ports 67, 68)
    iptables -A CAPTIVE_FW -p udp --dport 67:68 -j ACCEPT
    
    # Allow HTTP to captive portal
    iptables -A CAPTIVE_FW -p tcp -d "$PORTAL_IP" --dport "$PORTAL_PORT" -j ACCEPT
    iptables -A CAPTIVE_FW -p tcp -d "$PORTAL_IP" --dport 80 -j ACCEPT
    iptables -A CAPTIVE_FW -p tcp -d "$PORTAL_IP" --dport 443 -j ACCEPT
    
    # Allow local network traffic
    iptables -A CAPTIVE_FW -s "$PORTAL_NETWORK" -d "$PORTAL_IP" -j ACCEPT
    
    # Drop all other traffic by default (authenticated users will be added dynamically)
    iptables -A CAPTIVE_FW -j DROP
    
    # Apply to forwarding chain
    iptables -I FORWARD -i "$WLAN_INTERFACE" -j CAPTIVE_FW
    
    info "Firewall rules configured"
}

setup_ebtables() {
    info "Setting up Layer-2 isolation rules..."
    
    # Check if ebtables is available
    if ! command -v ebtables &>/dev/null; then
        warn "ebtables not installed, skipping L2 isolation setup"
        return
    fi
    
    # Create custom chain
    ebtables -N ISOLATION 2>/dev/null || ebtables -F ISOLATION
    
    # Block direct client-to-client communication
    # Allow traffic to/from gateway
    ebtables -A ISOLATION -d "$PORTAL_IP" -j ACCEPT
    ebtables -A ISOLATION -s "$PORTAL_IP" -j ACCEPT
    
    # Drop other traffic between clients
    ebtables -A ISOLATION -p IPv4 --ip-src "$PORTAL_NETWORK" --ip-dst "$PORTAL_NETWORK" -j DROP
    
    # Apply to bridge (if using bridge mode)
    if ip link show br0 &>/dev/null; then
        ebtables -A FORWARD -j ISOLATION
    fi
    
    info "Layer-2 isolation configured"
}

# ==============================================================================
# Service Management Functions
# ==============================================================================

start_services() {
    info "Starting captive portal services..."
    
    # Start hostapd
    if systemctl is-enabled hostapd &>/dev/null; then
        info "Starting hostapd..."
        systemctl start hostapd
    else
        warn "hostapd not enabled, start manually if needed"
    fi
    
    # Start dnsmasq
    if systemctl is-enabled dnsmasq &>/dev/null; then
        info "Starting dnsmasq..."
        systemctl start dnsmasq
    else
        warn "dnsmasq not enabled, start manually if needed"
    fi
    
    # Start captive portal backend
    if systemctl is-enabled captive-portal &>/dev/null; then
        info "Starting captive portal backend..."
        systemctl start captive-portal
    else
        warn "captive-portal service not enabled"
    fi
}

# ==============================================================================
# Status Functions
# ==============================================================================

show_status() {
    echo ""
    echo "========================================"
    echo "  Captive Portal Network Status"
    echo "========================================"
    echo ""
    echo "Interface: $WLAN_INTERFACE"
    ip addr show "$WLAN_INTERFACE" 2>/dev/null | grep "inet " || echo "  No IP assigned"
    echo ""
    echo "IP Forwarding:"
    echo "  $(cat /proc/sys/net/ipv4/ip_forward 2>/dev/null && echo 'enabled' || echo 'disabled')"
    echo ""
    echo "Services:"
    echo "  hostapd:        $(systemctl is-active hostapd 2>/dev/null || echo 'unknown')"
    echo "  dnsmasq:        $(systemctl is-active dnsmasq 2>/dev/null || echo 'unknown')"
    echo "  captive-portal: $(systemctl is-active captive-portal 2>/dev/null || echo 'unknown')"
    echo ""
    echo "NAT Rules:"
    iptables -t nat -L POSTROUTING -n 2>/dev/null | head -5 || echo "  No rules"
    echo ""
    echo "========================================"
}

# ==============================================================================
# Cleanup Function
# ==============================================================================

cleanup() {
    info "Cleaning up network configuration..."
    
    # Remove iptables rules
    iptables -t nat -D PREROUTING -i "$WLAN_INTERFACE" -j CAPTIVE_PORTAL 2>/dev/null || true
    iptables -t nat -F CAPTIVE_PORTAL 2>/dev/null || true
    iptables -t nat -X CAPTIVE_PORTAL 2>/dev/null || true
    
    iptables -D FORWARD -i "$WLAN_INTERFACE" -j CAPTIVE_FW 2>/dev/null || true
    iptables -F CAPTIVE_FW 2>/dev/null || true
    iptables -X CAPTIVE_FW 2>/dev/null || true
    
    # Remove ebtables rules
    if command -v ebtables &>/dev/null; then
        ebtables -F ISOLATION 2>/dev/null || true
        ebtables -X ISOLATION 2>/dev/null || true
    fi
    
    # Flush interface IP
    ip addr flush dev "$WLAN_INTERFACE" 2>/dev/null || true
    
    info "Cleanup completed"
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    case "${2:-setup}" in
        setup)
            check_root
            check_interface "$WLAN_INTERFACE"
            
            info "Starting network setup for captive portal..."
            info "WiFi Interface: $WLAN_INTERFACE"
            info "WAN Interface: $WAN_INTERFACE"
            info "Portal IP: $PORTAL_IP"
            
            setup_directories
            stop_conflicting_services
            configure_interface
            enable_ip_forwarding
            setup_iptables_nat
            setup_captive_portal_redirect
            setup_firewall_rules
            setup_ebtables
            start_services
            
            info "Network setup completed successfully!"
            show_status
            ;;
        
        cleanup)
            check_root
            cleanup
            ;;
        
        status)
            show_status
            ;;
        
        *)
            echo "Usage: $0 [interface] [setup|cleanup|status]"
            echo ""
            echo "Commands:"
            echo "  setup    - Configure network for captive portal (default)"
            echo "  cleanup  - Remove all captive portal network rules"
            echo "  status   - Show current network status"
            echo ""
            echo "Examples:"
            echo "  sudo $0              # Setup with default interface (wlan0)"
            echo "  sudo $0 wlan1 setup  # Setup with wlan1 interface"
            echo "  sudo $0 wlan0 status # Show status"
            exit 1
            ;;
    esac
}

main "$@"
