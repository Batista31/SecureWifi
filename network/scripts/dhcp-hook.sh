#!/bin/bash
# ==============================================================================
# DHCP Hook Script for Captive Portal
# ==============================================================================
# This script is called by dnsmasq when DHCP events occur.
# It logs DHCP events and can notify the captive portal backend.
#
# dnsmasq calls this script with:
#   $1 = event type (add, old, del)
#   $2 = MAC address
#   $3 = IP address
#   $4 = hostname (may be empty)
#
# Author: Captive Portal Team
# Version: 1.0.0
# ==============================================================================

# Configuration
LOG_FILE="/var/log/captive-portal/dhcp.log"
PORTAL_API="http://127.0.0.1:3000/api"
ENABLE_API_NOTIFY="${ENABLE_DHCP_API_NOTIFY:-true}"

# ==============================================================================
# Helper Functions
# ==============================================================================

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" >> "$LOG_FILE"
}

notify_api() {
    local endpoint="$1"
    local data="$2"
    
    if [[ "$ENABLE_API_NOTIFY" != "true" ]]; then
        return 0
    fi
    
    # Send notification to backend (non-blocking)
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$PORTAL_API/$endpoint" \
        --connect-timeout 2 \
        --max-time 5 \
        &>/dev/null &
}

# ==============================================================================
# Event Handlers
# ==============================================================================

handle_add() {
    local mac="$1"
    local ip="$2"
    local hostname="${3:-unknown}"
    
    log "DHCP ADD: MAC=$mac IP=$ip Hostname=$hostname"
    
    # Notify backend about new device
    notify_api "dhcp/add" "{
        \"mac\": \"$mac\",
        \"ip\": \"$ip\",
        \"hostname\": \"$hostname\",
        \"event\": \"add\",
        \"timestamp\": \"$(date -Iseconds)\"
    }"
    
    # Log to device tracking file
    echo "$(date -Iseconds) ADD $mac $ip $hostname" >> /var/log/captive-portal/devices.log
}

handle_old() {
    local mac="$1"
    local ip="$2"
    local hostname="${3:-unknown}"
    
    log "DHCP OLD (renewal): MAC=$mac IP=$ip Hostname=$hostname"
    
    # Notify backend about lease renewal
    notify_api "dhcp/renew" "{
        \"mac\": \"$mac\",
        \"ip\": \"$ip\",
        \"hostname\": \"$hostname\",
        \"event\": \"renew\",
        \"timestamp\": \"$(date -Iseconds)\"
    }"
}

handle_del() {
    local mac="$1"
    local ip="$2"
    local hostname="${3:-unknown}"
    
    log "DHCP DEL (release): MAC=$mac IP=$ip Hostname=$hostname"
    
    # Notify backend about device disconnect
    notify_api "dhcp/del" "{
        \"mac\": \"$mac\",
        \"ip\": \"$ip\",
        \"hostname\": \"$hostname\",
        \"event\": \"delete\",
        \"timestamp\": \"$(date -Iseconds)\"
    }"
    
    # Log to device tracking file
    echo "$(date -Iseconds) DEL $mac $ip $hostname" >> /var/log/captive-portal/devices.log
}

# ==============================================================================
# Main
# ==============================================================================

# Create log directory if it doesn't exist
mkdir -p /var/log/captive-portal

# Parse arguments from dnsmasq
EVENT_TYPE="$1"
MAC_ADDRESS="$2"
IP_ADDRESS="$3"
HOSTNAME="$4"

# Validate required arguments
if [[ -z "$EVENT_TYPE" ]] || [[ -z "$MAC_ADDRESS" ]] || [[ -z "$IP_ADDRESS" ]]; then
    log "ERROR: Missing required arguments: EVENT=$EVENT_TYPE MAC=$MAC_ADDRESS IP=$IP_ADDRESS"
    exit 1
fi

# Handle event
case "$EVENT_TYPE" in
    add)
        handle_add "$MAC_ADDRESS" "$IP_ADDRESS" "$HOSTNAME"
        ;;
    old)
        handle_old "$MAC_ADDRESS" "$IP_ADDRESS" "$HOSTNAME"
        ;;
    del)
        handle_del "$MAC_ADDRESS" "$IP_ADDRESS" "$HOSTNAME"
        ;;
    *)
        log "UNKNOWN EVENT: $EVENT_TYPE MAC=$MAC_ADDRESS IP=$IP_ADDRESS"
        ;;
esac

exit 0
