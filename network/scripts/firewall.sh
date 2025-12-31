#!/bin/bash
# ==============================================================================
# Firewall Management Script for Captive Portal
# ==============================================================================
# This script manages iptables and ebtables rules for the captive portal.
# It allows authenticated users to access the internet while blocking
# unauthenticated users.
#
# Usage: sudo ./firewall.sh [command] [options]
#
# Commands:
#   allow   <mac> <ip>    - Allow a device to access internet
#   block   <mac> <ip>    - Block a device from internet
#   status  [mac]         - Show firewall status
#   list                  - List all allowed devices
#   flush                 - Remove all dynamic rules
#   init                  - Initialize firewall rules
#
# Author: Captive Portal Team
# Version: 1.0.0
# ==============================================================================

set -e

# ==============================================================================
# Configuration
# ==============================================================================

WLAN_INTERFACE="${CAPTIVE_WLAN_INTERFACE:-wlan0}"
WAN_INTERFACE="${CAPTIVE_WAN_INTERFACE:-eth0}"
PORTAL_IP="${CAPTIVE_PORTAL_IP:-192.168.4.1}"
PORTAL_NETWORK="${CAPTIVE_PORTAL_NETWORK:-192.168.4.0/24}"

# Chain names
CHAIN_AUTH="CAPTIVE_AUTH"
CHAIN_FORWARD="CAPTIVE_FW"
CHAIN_NAT="CAPTIVE_PORTAL"

# Log file
LOG_FILE="/var/log/captive-portal/firewall.log"

# State file for tracking allowed MACs
STATE_DIR="/var/run/captive-portal"
ALLOWED_MACS_FILE="$STATE_DIR/allowed_macs"

# ==============================================================================
# Helper Functions
# ==============================================================================

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*"
    echo "[$timestamp] $*" >> "$LOG_FILE" 2>/dev/null || true
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo "Error: This script must be run as root"
        exit 1
    fi
}

validate_mac() {
    local mac="$1"
    if [[ ! "$mac" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]; then
        echo "Error: Invalid MAC address format: $mac"
        exit 1
    fi
}

validate_ip() {
    local ip="$1"
    if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Error: Invalid IP address format: $ip"
        exit 1
    fi
}

ensure_state_dir() {
    mkdir -p "$STATE_DIR"
    touch "$ALLOWED_MACS_FILE"
}

# ==============================================================================
# Firewall Functions
# ==============================================================================

init_chains() {
    log "Initializing firewall chains..."
    
    # Create authenticated users chain
    iptables -N "$CHAIN_AUTH" 2>/dev/null || iptables -F "$CHAIN_AUTH"
    
    # Create forward chain
    iptables -N "$CHAIN_FORWARD" 2>/dev/null || iptables -F "$CHAIN_FORWARD"
    
    # Create NAT chain
    iptables -t nat -N "$CHAIN_NAT" 2>/dev/null || iptables -t nat -F "$CHAIN_NAT"
    
    log "Firewall chains initialized"
}

setup_base_rules() {
    log "Setting up base firewall rules..."
    
    # Remove existing rules first
    iptables -D FORWARD -i "$WLAN_INTERFACE" -j "$CHAIN_FORWARD" 2>/dev/null || true
    iptables -t nat -D PREROUTING -i "$WLAN_INTERFACE" -j "$CHAIN_NAT" 2>/dev/null || true
    
    # === FORWARD CHAIN RULES ===
    
    # 1. Allow established connections
    iptables -A "$CHAIN_FORWARD" -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    # 2. Check authenticated users chain
    iptables -A "$CHAIN_FORWARD" -j "$CHAIN_AUTH"
    
    # 3. Allow DNS (for captive portal detection)
    iptables -A "$CHAIN_FORWARD" -p udp --dport 53 -j ACCEPT
    iptables -A "$CHAIN_FORWARD" -p tcp --dport 53 -j ACCEPT
    
    # 4. Allow traffic to portal
    iptables -A "$CHAIN_FORWARD" -d "$PORTAL_IP" -j ACCEPT
    
    # 5. Drop everything else
    iptables -A "$CHAIN_FORWARD" -j DROP
    
    # Insert into main FORWARD chain
    iptables -I FORWARD -i "$WLAN_INTERFACE" -j "$CHAIN_FORWARD"
    
    # === NAT CHAIN RULES ===
    
    # Redirect HTTP to portal (for unauthenticated users)
    iptables -t nat -A "$CHAIN_NAT" -p tcp --dport 80 -j DNAT --to-destination "$PORTAL_IP:3000"
    
    # Insert into PREROUTING
    iptables -t nat -I PREROUTING -i "$WLAN_INTERFACE" -j "$CHAIN_NAT"
    
    log "Base firewall rules configured"
}

allow_device() {
    local mac="$1"
    local ip="$2"
    
    validate_mac "$mac"
    validate_ip "$ip"
    ensure_state_dir
    
    # Normalize MAC to uppercase
    mac=$(echo "$mac" | tr '[:lower:]' '[:upper:]')
    
    log "Allowing device: MAC=$mac IP=$ip"
    
    # Check if already allowed
    if grep -q "^$mac " "$ALLOWED_MACS_FILE" 2>/dev/null; then
        log "Device already allowed, updating IP"
        sed -i "/^$mac /d" "$ALLOWED_MACS_FILE"
    fi
    
    # Add iptables rules for this MAC/IP
    # Allow forwarding for this device
    iptables -I "$CHAIN_AUTH" -m mac --mac-source "$mac" -s "$ip" -j ACCEPT 2>/dev/null || true
    
    # Skip NAT redirect for authenticated device
    iptables -t nat -I "$CHAIN_NAT" -m mac --mac-source "$mac" -j RETURN 2>/dev/null || true
    
    # Add ebtables rule if available
    if command -v ebtables &>/dev/null; then
        ebtables -I FORWARD -s "$mac" -j ACCEPT 2>/dev/null || true
    fi
    
    # Record in state file
    echo "$mac $ip $(date -Iseconds)" >> "$ALLOWED_MACS_FILE"
    
    log "Device allowed successfully"
    echo "OK: Device $mac ($ip) is now allowed"
}

block_device() {
    local mac="$1"
    local ip="$2"
    
    validate_mac "$mac"
    validate_ip "$ip"
    ensure_state_dir
    
    # Normalize MAC to uppercase
    mac=$(echo "$mac" | tr '[:lower:]' '[:upper:]')
    
    log "Blocking device: MAC=$mac IP=$ip"
    
    # Remove iptables rules
    iptables -D "$CHAIN_AUTH" -m mac --mac-source "$mac" -s "$ip" -j ACCEPT 2>/dev/null || true
    iptables -t nat -D "$CHAIN_NAT" -m mac --mac-source "$mac" -j RETURN 2>/dev/null || true
    
    # Remove ebtables rule if available
    if command -v ebtables &>/dev/null; then
        ebtables -D FORWARD -s "$mac" -j ACCEPT 2>/dev/null || true
    fi
    
    # Remove from state file
    if [[ -f "$ALLOWED_MACS_FILE" ]]; then
        sed -i "/^$mac /d" "$ALLOWED_MACS_FILE"
    fi
    
    # Drop existing connections from this device
    conntrack -D --src "$ip" 2>/dev/null || true
    
    log "Device blocked successfully"
    echo "OK: Device $mac ($ip) is now blocked"
}

show_status() {
    local mac="$1"
    
    echo "========================================"
    echo "  Captive Portal Firewall Status"
    echo "========================================"
    echo ""
    
    if [[ -n "$mac" ]]; then
        # Show status for specific MAC
        validate_mac "$mac"
        mac=$(echo "$mac" | tr '[:lower:]' '[:upper:]')
        
        if grep -q "^$mac " "$ALLOWED_MACS_FILE" 2>/dev/null; then
            local entry=$(grep "^$mac " "$ALLOWED_MACS_FILE")
            echo "Device: $mac"
            echo "Status: ALLOWED"
            echo "Details: $entry"
        else
            echo "Device: $mac"
            echo "Status: BLOCKED"
        fi
    else
        # Show general status
        echo "Interface: $WLAN_INTERFACE"
        echo "Portal IP: $PORTAL_IP"
        echo ""
        echo "Authenticated Users Chain ($CHAIN_AUTH):"
        iptables -L "$CHAIN_AUTH" -n 2>/dev/null || echo "  Chain not found"
        echo ""
        echo "NAT Rules ($CHAIN_NAT):"
        iptables -t nat -L "$CHAIN_NAT" -n 2>/dev/null || echo "  Chain not found"
        echo ""
        echo "Allowed Devices:"
        if [[ -f "$ALLOWED_MACS_FILE" ]] && [[ -s "$ALLOWED_MACS_FILE" ]]; then
            cat "$ALLOWED_MACS_FILE" | while read mac ip timestamp; do
                echo "  $mac - $ip - $timestamp"
            done
        else
            echo "  No devices currently allowed"
        fi
    fi
    echo ""
    echo "========================================"
}

list_allowed() {
    ensure_state_dir
    
    echo "Allowed Devices:"
    echo "================"
    
    if [[ -f "$ALLOWED_MACS_FILE" ]] && [[ -s "$ALLOWED_MACS_FILE" ]]; then
        printf "%-20s %-15s %s\n" "MAC Address" "IP Address" "Since"
        printf "%-20s %-15s %s\n" "-------------------" "--------------" "-------------------------"
        cat "$ALLOWED_MACS_FILE" | while read mac ip timestamp; do
            printf "%-20s %-15s %s\n" "$mac" "$ip" "$timestamp"
        done
        echo ""
        echo "Total: $(wc -l < "$ALLOWED_MACS_FILE") devices"
    else
        echo "No devices currently allowed"
    fi
}

flush_rules() {
    log "Flushing all dynamic firewall rules..."
    
    # Flush authenticated users chain
    iptables -F "$CHAIN_AUTH" 2>/dev/null || true
    
    # Remove NAT skip rules (keep base redirect)
    iptables -t nat -F "$CHAIN_NAT" 2>/dev/null || true
    
    # Re-add base NAT rule
    iptables -t nat -A "$CHAIN_NAT" -p tcp --dport 80 -j DNAT --to-destination "$PORTAL_IP:3000" 2>/dev/null || true
    
    # Flush ebtables rules
    if command -v ebtables &>/dev/null; then
        ebtables -F FORWARD 2>/dev/null || true
    fi
    
    # Clear state file
    > "$ALLOWED_MACS_FILE" 2>/dev/null || true
    
    # Clear connection tracking
    conntrack -F 2>/dev/null || true
    
    log "All dynamic rules flushed"
    echo "OK: All dynamic firewall rules have been flushed"
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    check_root
    
    local command="${1:-help}"
    
    case "$command" in
        init)
            init_chains
            setup_base_rules
            ;;
        
        allow)
            if [[ -z "$2" ]] || [[ -z "$3" ]]; then
                echo "Usage: $0 allow <mac> <ip>"
                exit 1
            fi
            allow_device "$2" "$3"
            ;;
        
        block)
            if [[ -z "$2" ]] || [[ -z "$3" ]]; then
                echo "Usage: $0 block <mac> <ip>"
                exit 1
            fi
            block_device "$2" "$3"
            ;;
        
        status)
            show_status "$2"
            ;;
        
        list)
            list_allowed
            ;;
        
        flush)
            flush_rules
            ;;
        
        help|--help|-h|*)
            echo "Captive Portal Firewall Management"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  init              Initialize firewall chains and base rules"
            echo "  allow <mac> <ip>  Allow device to access internet"
            echo "  block <mac> <ip>  Block device from internet"
            echo "  status [mac]      Show firewall status (optionally for specific MAC)"
            echo "  list              List all allowed devices"
            echo "  flush             Remove all dynamic rules"
            echo ""
            echo "Examples:"
            echo "  $0 init"
            echo "  $0 allow AA:BB:CC:DD:EE:FF 192.168.4.100"
            echo "  $0 block AA:BB:CC:DD:EE:FF 192.168.4.100"
            echo "  $0 status AA:BB:CC:DD:EE:FF"
            echo "  $0 list"
            ;;
    esac
}

main "$@"
