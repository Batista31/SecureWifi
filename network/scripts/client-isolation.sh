#!/bin/bash
# ==============================================================================
# Client Isolation Script for Captive Portal
# ==============================================================================
# This script implements Layer-2 client isolation using ebtables.
# It prevents direct communication between WiFi clients while allowing
# them to communicate with the gateway.
#
# Usage: sudo ./client-isolation.sh [enable|disable|status]
#
# Author: Captive Portal Team
# Version: 1.0.0
# ==============================================================================

set -e

# ==============================================================================
# Configuration
# ==============================================================================

WLAN_INTERFACE="${CAPTIVE_WLAN_INTERFACE:-wlan0}"
PORTAL_IP="${CAPTIVE_PORTAL_IP:-192.168.4.1}"
PORTAL_NETWORK="${CAPTIVE_PORTAL_NETWORK:-192.168.4.0/24}"
GATEWAY_MAC=""  # Will be determined automatically

# Chain name
CHAIN_ISOLATION="CAPTIVE_ISOLATION"

# Log file
LOG_FILE="/var/log/captive-portal/isolation.log"

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

check_ebtables() {
    if ! command -v ebtables &>/dev/null; then
        echo "Error: ebtables is not installed"
        echo "Install with: sudo apt install ebtables"
        exit 1
    fi
}

get_gateway_mac() {
    # Get MAC address of the WiFi interface
    GATEWAY_MAC=$(ip link show "$WLAN_INTERFACE" 2>/dev/null | awk '/ether/ {print $2}')
    
    if [[ -z "$GATEWAY_MAC" ]]; then
        echo "Error: Could not determine MAC address for $WLAN_INTERFACE"
        exit 1
    fi
    
    log "Gateway MAC: $GATEWAY_MAC"
}

# ==============================================================================
# Isolation Functions
# ==============================================================================

enable_isolation() {
    log "Enabling Layer-2 client isolation..."
    
    # Get gateway MAC
    get_gateway_mac
    
    # Create isolation chain if it doesn't exist
    ebtables -N "$CHAIN_ISOLATION" 2>/dev/null || ebtables -F "$CHAIN_ISOLATION"
    
    # Remove existing rules from FORWARD chain
    ebtables -D FORWARD -i "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -D FORWARD -o "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    
    # === ISOLATION RULES ===
    
    # 1. Allow broadcast traffic (needed for DHCP, ARP)
    ebtables -A "$CHAIN_ISOLATION" -d Broadcast -j ACCEPT
    
    # 2. Allow multicast traffic (needed for mDNS, IGMP)
    ebtables -A "$CHAIN_ISOLATION" -d Multicast -j ACCEPT
    
    # 3. Allow traffic to gateway
    ebtables -A "$CHAIN_ISOLATION" -d "$GATEWAY_MAC" -j ACCEPT
    
    # 4. Allow traffic from gateway
    ebtables -A "$CHAIN_ISOLATION" -s "$GATEWAY_MAC" -j ACCEPT
    
    # 5. Allow ARP traffic (essential for IP resolution)
    ebtables -A "$CHAIN_ISOLATION" -p ARP -j ACCEPT
    
    # 6. Drop all other traffic between clients
    # This blocks direct client-to-client communication
    ebtables -A "$CHAIN_ISOLATION" -j DROP
    
    # Apply to FORWARD chain for traffic through the interface
    ebtables -A FORWARD -i "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION"
    ebtables -A FORWARD -o "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION"
    
    # Also apply to INPUT/OUTPUT for extra protection
    ebtables -D INPUT -i "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -D OUTPUT -o "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    
    log "Layer-2 client isolation enabled"
    echo "OK: Client isolation is now ENABLED"
    echo "    - Clients cannot communicate directly with each other"
    echo "    - All traffic must go through the gateway ($PORTAL_IP)"
}

disable_isolation() {
    log "Disabling Layer-2 client isolation..."
    
    # Remove rules from chains
    ebtables -D FORWARD -i "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -D FORWARD -o "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -D INPUT -i "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -D OUTPUT -o "$WLAN_INTERFACE" -j "$CHAIN_ISOLATION" 2>/dev/null || true
    
    # Flush and delete chain
    ebtables -F "$CHAIN_ISOLATION" 2>/dev/null || true
    ebtables -X "$CHAIN_ISOLATION" 2>/dev/null || true
    
    log "Layer-2 client isolation disabled"
    echo "OK: Client isolation is now DISABLED"
    echo "    - Clients can communicate directly with each other"
}

show_status() {
    echo "========================================"
    echo "  Layer-2 Client Isolation Status"
    echo "========================================"
    echo ""
    echo "Interface: $WLAN_INTERFACE"
    echo ""
    
    # Check if isolation chain exists
    if ebtables -L "$CHAIN_ISOLATION" &>/dev/null; then
        echo "Status: ENABLED"
        echo ""
        echo "Isolation Chain Rules:"
        ebtables -L "$CHAIN_ISOLATION" --Lc 2>/dev/null
    else
        echo "Status: DISABLED"
    fi
    
    echo ""
    echo "========================================"
    
    # Show additional bridge info if available
    if brctl show 2>/dev/null | grep -q "$WLAN_INTERFACE"; then
        echo ""
        echo "Bridge Configuration:"
        brctl show 2>/dev/null
    fi
}

# ==============================================================================
# AP Isolation via hostapd
# ==============================================================================

check_ap_isolation() {
    echo "Checking hostapd AP isolation setting..."
    
    local hostapd_conf="/etc/hostapd/hostapd.conf"
    
    if [[ -f "$hostapd_conf" ]]; then
        if grep -q "^ap_isolate=1" "$hostapd_conf"; then
            echo "  hostapd ap_isolate: ENABLED"
        elif grep -q "^ap_isolate=0" "$hostapd_conf"; then
            echo "  hostapd ap_isolate: DISABLED"
        else
            echo "  hostapd ap_isolate: NOT SET (default: disabled)"
        fi
    else
        echo "  hostapd config not found at $hostapd_conf"
    fi
}

enable_ap_isolation_hostapd() {
    local hostapd_conf="/etc/hostapd/hostapd.conf"
    
    if [[ ! -f "$hostapd_conf" ]]; then
        echo "Error: hostapd config not found"
        exit 1
    fi
    
    # Enable ap_isolate in hostapd
    if grep -q "^ap_isolate=" "$hostapd_conf"; then
        sed -i 's/^ap_isolate=.*/ap_isolate=1/' "$hostapd_conf"
    else
        echo "ap_isolate=1" >> "$hostapd_conf"
    fi
    
    echo "AP isolation enabled in hostapd config"
    echo "Restart hostapd for changes to take effect: sudo systemctl restart hostapd"
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    local command="${1:-status}"
    
    case "$command" in
        enable)
            check_root
            check_ebtables
            enable_isolation
            ;;
        
        disable)
            check_root
            check_ebtables
            disable_isolation
            ;;
        
        status)
            check_ebtables
            show_status
            check_ap_isolation
            ;;
        
        hostapd-enable)
            check_root
            enable_ap_isolation_hostapd
            ;;
        
        help|--help|-h)
            echo "Layer-2 Client Isolation Management"
            echo ""
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  enable          Enable ebtables client isolation"
            echo "  disable         Disable ebtables client isolation"
            echo "  status          Show current isolation status"
            echo "  hostapd-enable  Enable ap_isolate in hostapd config"
            echo ""
            echo "This script prevents direct communication between WiFi clients."
            echo "All traffic must go through the gateway, enabling proper monitoring"
            echo "and access control."
            echo ""
            echo "Note: hostapd also supports ap_isolate which provides similar"
            echo "functionality at the driver level. Using both provides defense"
            echo "in depth."
            ;;
        
        *)
            echo "Unknown command: $command"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"
