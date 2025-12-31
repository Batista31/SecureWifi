# Secure Public Wi-Fi Access System

## Captive Portal Authentication with Layer-2 Client Isolation

### Complete Project Documentation

A comprehensive WiFi captive portal system designed for secure public network access. This academic project implements enterprise-grade security features including MAC-based authentication, Layer-2 client isolation using ebtables, and a modern React admin dashboard.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Phases](#project-phases)
   - [Phase 1: Core Backend & Captive Portal](#phase-1-core-backend--captive-portal)
   - [Phase 2: Security Automation & Rule Engine](#phase-2-security-automation--rule-engine)
   - [Phase 3: React Admin Dashboard](#phase-3-react-admin-dashboard)
   - [Phase 4: Network Integration](#phase-4-network-integration)
   - [Phase 5: Hardware Deployment](#phase-5-hardware-deployment)
   - [Phase 6: Testing & Documentation](#phase-6-testing--documentation)
5. [Installation & Setup](#installation--setup)
6. [Running the Application](#running-the-application)
7. [API Documentation](#api-documentation)
8. [Project Structure](#project-structure)
9. [Security Features](#security-features)
10. [Default Credentials](#default-credentials)

---

## 🎯 Project Overview

This system provides secure WiFi access for public environments (cafes, hotels, libraries) with:

- **Captive Portal**: Intercepts new connections and redirects to authentication page
- **Multiple Auth Methods**: Voucher codes, SMS verification, user registration
- **Layer-2 Isolation**: Prevents client-to-client attacks using ebtables
- **MAC/IP Binding**: Prevents spoofing attacks
- **Admin Dashboard**: Real-time monitoring and management
- **Simulation Mode**: Safe development without affecting real network

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard                          │
│                    (React + Vite + Tailwind)                    │
│                       Port: 5173                                │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Server                             │
│                   (Node.js + Express)                           │
│                       Port: 3000                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Service │  │Session Svc   │  │ Voucher Svc  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │Device Service│  │ Logging Svc  │  │ Firewall Svc │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                      Rule Engine                                │
│         (iptables + ebtables + MAC/IP Binding)                  │
│                   [SIMULATION MODE]                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SQLite Database                             │
│    (Users, Sessions, Vouchers, Devices, Logs, Bindings)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Backend
| Component | Technology |
|-----------|------------|
| Runtime | Node.js v18+ |
| Framework | Express.js 4.x |
| Database | SQLite (better-sqlite3) |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcryptjs |
| Security | Helmet, CORS, Rate Limiting |
| Logging | Morgan |

### Frontend - Captive Portal
| Component | Technology |
|-----------|------------|
| HTML/CSS | Vanilla (responsive design) |
| JavaScript | ES6+ Modules |
| Styling | Custom CSS with variables |

### Frontend - Admin Dashboard
| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 6 |
| Charts | Recharts |
| Icons | Lucide React |

### Security Layer
| Component | Technology |
|-----------|------------|
| Layer 3 Firewall | iptables (simulated) |
| Layer 2 Firewall | ebtables (simulated) |
| Binding | ARP + MAC/IP tables |

---

## 📦 Project Phases

---

### Phase 1: Core Backend & Captive Portal
**Status: ✅ Complete**

The foundation of the system including the Express.js backend, SQLite database, and captive portal UI.

#### Components Built:

**1. Database Schema (`backend/src/services/database.service.js`)**

```sql
-- Tables Created:
- users           -- Registered user accounts
- vouchers        -- Pre-generated access codes  
- devices         -- Known devices by MAC address
- sessions        -- Active and historical sessions
- event_logs      -- System and security events
- mac_ip_bindings -- MAC to IP address bindings
- admin_users     -- Administrator accounts
```

**2. Backend Services**

| Service | File | Purpose |
|---------|------|---------|
| Auth | `auth.service.js` | User authentication, password hashing, JWT |
| Session | `session.service.js` | Session lifecycle, expiry, extension |
| Voucher | `voucher.service.js` | Voucher CRUD, validation, usage tracking |
| Device | `device.service.js` | Device tracking, blocking, vendor lookup |
| Logging | `logging.service.js` | Event logging, statistics |

**3. REST API Routes**

| Route | Purpose |
|-------|---------|
| `/api/auth/*` | User authentication (login, register, voucher) |
| `/api/portal/*` | Captive portal status and client info |
| `/api/sessions/*` | Session management |
| `/api/admin/*` | Admin dashboard APIs |

**4. Captive Portal UI (`portal/`)**

| File | Purpose |
|------|---------|
| `index.html` | Landing page with authentication options |
| `login.html` | Voucher code entry form |
| `register.html` | User registration form |
| `success.html` | Post-authentication success page |
| `terms.html` | Terms of service |

**5. Captive Portal Detection**

Handles standard OS detection endpoints:
```
/generate_204        → Android
/hotspot-detect.html → Apple iOS/macOS
/ncsi.txt            → Windows
/connecttest.txt     → Windows 10+
/success.txt         → Generic
```

#### Key Features:
- ✅ JWT-based authentication
- ✅ Rate limiting on auth endpoints (100 req/15min)
- ✅ Input validation with express-validator
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Morgan request logging
- ✅ Automatic session cleanup

---

### Phase 2: Security Automation & Rule Engine
**Status: ✅ Complete**

Implements the firewall rule generation and client isolation using iptables (Layer 3) and ebtables (Layer 2).

#### Components Built:

**1. iptables Service (`backend/src/services/firewall/iptables.service.js`)**

Manages Layer 3 (IP) firewall rules:

```javascript
// Rule Chain: CAPTIVE_PORTAL (custom chain in PREROUTING)

Rule Types Generated:
┌────────────────────────┬─────────────────────────────────────────┐
│ CAPTIVE_REDIRECT       │ Redirect HTTP to portal (port 80→3000) │
│ ALLOW_DNS              │ Allow DNS queries (UDP port 53)        │
│ ALLOW_DHCP             │ Allow DHCP (UDP ports 67, 68)          │
│ ALLOW_AUTHENTICATED    │ ACCEPT for authenticated MAC addresses │
│ DROP_DEFAULT           │ DROP all other traffic                 │
└────────────────────────┴─────────────────────────────────────────┘
```

Example generated rules:
```bash
iptables -t nat -N CAPTIVE_PORTAL
iptables -t nat -A PREROUTING -i wlan0 -j CAPTIVE_PORTAL
iptables -t nat -A CAPTIVE_PORTAL -p tcp --dport 80 -j DNAT --to-destination 192.168.4.1:3000
iptables -A FORWARD -m mac --mac-source AA:BB:CC:DD:EE:FF -j ACCEPT
```

**2. ebtables Service (`backend/src/services/firewall/ebtables.service.js`)**

Manages Layer 2 (Ethernet) bridge filtering for client isolation:

```javascript
// Rule Chain: ISOLATION (custom chain in FORWARD)

Rule Types Generated:
┌────────────────────────┬─────────────────────────────────────────┐
│ ISOLATE_CLIENTS        │ Block client-to-client traffic         │
│ ALLOW_GATEWAY          │ Allow traffic to/from gateway          │
│ ALLOW_AUTHENTICATED    │ Permit authenticated device traffic    │
│ LOG_VIOLATIONS         │ Log policy violations                  │
└────────────────────────┴─────────────────────────────────────────┘
```

Example generated rules:
```bash
ebtables -N ISOLATION
ebtables -A FORWARD -j ISOLATION
ebtables -A ISOLATION -s AA:BB:CC:DD:EE:FF -j ACCEPT
ebtables -A ISOLATION -d AA:BB:CC:DD:EE:FF -j ACCEPT
ebtables -A ISOLATION --log-prefix "ISOLATION: " -j DROP
```

**3. MAC/IP Binding Service (`backend/src/services/firewall/binding.service.js`)**

Prevents IP/MAC spoofing attacks:

```javascript
// Binding Lifecycle:
1. createBinding(mac, ip, sessionId)  → Store in database
2. validateBinding(mac, ip)           → Check on each request
3. removeBinding(mac)                 → Cleanup on logout
4. detectSpoofing(mac, ip)           → Alert on mismatch

// Spoofing Detection:
- IP used by different MAC → Block & Alert
- MAC using different IP   → Block & Alert
```

**4. Rule Engine Orchestrator (`backend/src/services/firewall/rule-engine.service.js`)**

Central coordinator for all firewall operations:

```javascript
class RuleEngine {
  // Grant internet access to authenticated device
  async grantAccess(mac, ip, sessionId) {
    await iptables.allowMac(mac);           // Layer 3
    await ebtables.allowMac(mac);           // Layer 2
    await binding.createBinding(mac, ip);   // Anti-spoof
  }
  
  // Revoke access on logout/expiry
  async revokeAccess(mac, ip) {
    await iptables.removeMac(mac);
    await ebtables.removeMac(mac);
    await binding.removeBinding(mac);
  }
  
  // Initialize base rules on startup
  async initialize() {
    await iptables.initialize();
    await ebtables.initialize();
  }
}
```

**5. Firewall API Routes (`backend/src/routes/firewall.routes.js`)**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/firewall/status` | GET | Get firewall state and mode |
| `/api/firewall/rules` | GET | List all active rules |
| `/api/firewall/bindings` | GET | List MAC/IP bindings |
| `/api/firewall/grant` | POST | Grant access (testing) |
| `/api/firewall/revoke` | POST | Revoke access (testing) |
| `/api/firewall/explain` | GET | Educational explanation |

#### Simulation Mode

All firewall operations run in **SIMULATION MODE** by default:

```javascript
// In .env file:
SECURITY_MODE=simulation  // Safe mode (default)
SECURITY_MODE=live        // Real firewall execution

// Simulation behavior:
- Commands are generated but NOT executed
- All rules are logged to console
- Works on any OS (Windows, Mac, Linux)
- Perfect for development and testing
```

#### Test Results (Phase 2):

```
Test Suite: Phase 2 - Security Automation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Rule engine initializes correctly
✓ iptables generates CAPTIVE_REDIRECT rule
✓ iptables generates ALLOW_DNS rule
✓ iptables generates ALLOW_DHCP rule
✓ iptables generates ALLOW_AUTHENTICATED rule
✓ ebtables generates ISOLATION chain
✓ ebtables generates client isolation rules
✓ MAC/IP binding is created correctly
✓ Binding validation works
✓ Spoofing detection triggers alert
✓ Access grant creates all rules
✓ Access revoke removes all rules
✓ Session expiry triggers cleanup
✓ Multiple devices handled correctly
✓ Firewall status API works
✓ Firewall rules API works
✓ Firewall explain API works

Results: 17/17 tests passed (100%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Phase 3: React Admin Dashboard
**Status: ✅ Complete**

A modern, responsive admin dashboard for monitoring and managing the WiFi system.

#### Project Setup

```
dashboard/
├── package.json          # Dependencies
├── vite.config.js        # Vite + proxy config
├── tailwind.config.js    # Tailwind theme
├── postcss.config.js     # PostCSS plugins
├── index.html            # HTML entry
└── src/
    ├── main.jsx          # React entry
    ├── App.jsx           # Routes
    ├── index.css         # Tailwind + custom styles
    ├── components/
    │   └── Layout.jsx    # Sidebar layout
    ├── context/
    │   └── AuthContext.jsx  # Auth state
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Sessions.jsx
    │   ├── Devices.jsx
    │   ├── Vouchers.jsx
    │   ├── Firewall.jsx
    │   ├── Logs.jsx
    │   └── Settings.jsx
    └── services/
        └── api.js        # API client
```

#### Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

#### Pages Built

**1. Login Page (`Login.jsx`)**
- Dark themed design
- Username/password form
- JWT authentication
- Error display
- Default credentials hint

**2. Dashboard (`Dashboard.jsx`)**
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Stats Cards                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Active  │ │ Total   │ │ Blocked │ │ Vouchers│          │
│  │Sessions │ │ Devices │ │ Devices │ │Available│          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
├─────────────────────────────────────────────────────────────┤
│  📈 Session Trends (AreaChart)    │  🥧 Auth Methods (Pie) │
├─────────────────────────────────────────────────────────────┤
│  🖥️ System Status                 │  📋 Recent Activity    │
└─────────────────────────────────────────────────────────────┘
```

**3. Sessions (`Sessions.jsx`)**
- Active session table
- Search by MAC/IP/user
- Filter by status
- Time remaining display
- Disconnect button
- Extend session action

**4. Devices (`Devices.jsx`)**
- Device grid cards
- Block/unblock toggle
- Device statistics
- Vendor information
- Last seen timestamp
- Session history

**5. Vouchers (`Vouchers.jsx`)**
- Voucher table with status
- Generation modal:
  - Count (1-100)
  - Duration (1-24 hours)
  - Max devices
- Batch creation
- CSV export
- Deactivate vouchers

**6. Firewall (`Firewall.jsx`)**
```
┌─────────────────────────────────────────────────────────────┐
│  Tabs: [Overview] [iptables] [ebtables] [Bindings]         │
├─────────────────────────────────────────────────────────────┤
│  Overview Tab:                                              │
│  - Mode indicator (Simulation/Live)                         │
│  - Rule counts                                              │
│  - Active bindings count                                    │
│  - Test grant access button                                 │
├─────────────────────────────────────────────────────────────┤
│  iptables Tab:                                              │
│  - NAT rules section                                        │
│  - Filter rules section                                     │
│  - Expandable rule details                                  │
├─────────────────────────────────────────────────────────────┤
│  ebtables Tab:                                              │
│  - Isolation chain rules                                    │
│  - Forward chain rules                                      │
├─────────────────────────────────────────────────────────────┤
│  Bindings Tab:                                              │
│  - MAC/IP binding cards                                     │
│  - Session association                                      │
│  - Creation timestamp                                       │
└─────────────────────────────────────────────────────────────┘
```

**7. Logs (`Logs.jsx`)**
- Event log table
- Category filter (AUTH, SESSION, SECURITY, etc.)
- Severity filter (DEBUG, INFO, WARNING, ERROR)
- Search functionality
- Pagination (load more)
- CSV export

**8. Settings (`Settings.jsx`)**
```
┌─────────────────────────────────────────────────────────────┐
│  Session Settings                                           │
│  - Session timeout (dropdown)                               │
│  - Max devices per user                                     │
│  - Allow session extension (toggle)                         │
├─────────────────────────────────────────────────────────────┤
│  Captive Portal                                             │
│  - Portal title                                             │
│  - Welcome message                                          │
│  - Require terms acceptance (toggle)                        │
├─────────────────────────────────────────────────────────────┤
│  Authentication Methods                                     │
│  - SMS auth (toggle)                                        │
│  - Voucher auth (toggle)                                    │
│  - Social auth (toggle)                                     │
├─────────────────────────────────────────────────────────────┤
│  Security Settings                                          │
│  - Simulation mode (toggle)                                 │
│  - Client isolation (toggle)                                │
│  - MAC binding (toggle)                                     │
│  - Auto-block suspicious (toggle)                           │
├─────────────────────────────────────────────────────────────┤
│  Rate Limiting                                              │
│  - Auth attempts limit                                      │
│  - Rate window (seconds)                                    │
├─────────────────────────────────────────────────────────────┤
│  Data Management                                            │
│  - Log retention (days)                                     │
│  - Cleanup interval                                         │
│  - [Clear Expired Sessions] [Purge Old Logs]               │
└─────────────────────────────────────────────────────────────┘
```

#### UI Features
- ✅ Dark theme login page
- ✅ Light theme dashboard
- ✅ Responsive design (mobile-friendly)
- ✅ Loading states
- ✅ Error handling
- ✅ Real-time data refresh
- ✅ Interactive charts (Recharts)
- ✅ Icon library (Lucide)

---

### Phase 4: Network Integration
**Status: 🔜 Pending**

Configuration files for Linux network services to create actual WiFi hotspot.

#### Planned Components:

**1. hostapd Configuration (`/etc/hostapd/hostapd.conf`)**
```conf
interface=wlan0
driver=nl80211
ssid=SecureWiFi
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=YourPassword
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```

**2. dnsmasq Configuration (`/etc/dnsmasq.conf`)**
```conf
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.254,255.255.255.0,24h
address=/#/192.168.4.1
```

**3. Network Scripts**
- Interface setup
- IP forwarding
- NAT configuration
- Bridge setup

---

### Phase 5: Hardware Deployment
**Status: 🔜 Pending**

Raspberry Pi configuration and deployment.

#### Planned Components:
- Raspberry Pi OS setup
- USB WiFi adapter config
- Auto-start services (systemd)
- Network interface setup
- Performance tuning

---

### Phase 6: Testing & Documentation
**Status: 🔜 Pending**

#### Planned Components:
- Unit tests
- Integration tests
- Security testing
- Academic report
- Presentation

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher

### Install Dependencies

```bash
# Root directory
cd wifi-captive-portal
npm install

# Backend
cd backend
npm install

# Dashboard
cd ../dashboard
npm install
```

### Initialize Database

```bash
cd wifi-captive-portal
npm run init-db
```

### Environment Configuration (`.env`)

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Security Mode
SECURITY_MODE=simulation

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h

# Network (for live mode)
WIFI_INTERFACE=wlan0
PORTAL_IP=192.168.4.1
```

---

## ▶️ Running the Application

### Terminal 1 - Backend
```bash
cd wifi-captive-portal/backend
node src/app.js
```

Output:
```
✓ Database initialized
✓ Rule engine initialized

========================================
  WiFi Captive Portal Server Started
========================================
  Mode:     simulation
  URL:      http://localhost:3000
  Portal:   http://localhost:3000/portal
  API:      http://localhost:3000/api
========================================
```

### Terminal 2 - Dashboard
```bash
cd wifi-captive-portal/dashboard
npm run dev
```

Output:
```
VITE v5.4.21  ready in 400 ms
➜  Local:   http://localhost:5173/
```

### Access Points

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000/api |
| Captive Portal | http://localhost:3000/portal |
| Admin Dashboard | http://localhost:5173 |

---

## 📡 API Documentation

### Admin Authentication

```http
POST /api/admin/login
Content-Type: application/json

{"username": "admin", "password": "admin123"}

Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "admin": {"id": 1, "username": "admin", "role": "admin"}
}
```

### Voucher Authentication

```http
POST /api/auth/voucher
Content-Type: application/json

{
  "code": "WIFI-XXXX-XXXX",
  "mac": "AA:BB:CC:DD:EE:FF",
  "ip": "192.168.4.100"
}
```

### Session Management

```http
GET /api/admin/sessions
Authorization: Bearer <token>

DELETE /api/admin/sessions/:id
Authorization: Bearer <token>
```

### Device Management

```http
GET /api/admin/devices
POST /api/admin/devices/:mac/block
POST /api/admin/devices/:mac/unblock
```

### Voucher Management

```http
GET /api/admin/vouchers
POST /api/admin/vouchers
Body: {"count": 10, "durationHours": 4, "maxDevices": 1}
```

### Firewall

```http
GET /api/firewall/status
GET /api/firewall/rules
GET /api/firewall/bindings
POST /api/firewall/grant
POST /api/firewall/revoke
```

---

## 📁 Project Structure

```
wifi-captive-portal/
├── .env
├── package.json
├── README.md
├── DOCUMENTATION.md        ← This file
├── test-phase2.js
│
├── backend/
│   └── src/
│       ├── app.js
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       │   ├── admin.routes.js
│       │   ├── auth.routes.js
│       │   ├── firewall.routes.js
│       │   ├── monitoring.routes.js
│       │   ├── portal.routes.js
│       │   └── session.routes.js
│       ├── services/
│       │   ├── auth.service.js
│       │   ├── database.service.js
│       │   ├── device.service.js
│       │   ├── logging.service.js
│       │   ├── session.service.js
│       │   ├── voucher.service.js
│       │   └── firewall/
│       │       ├── binding.service.js
│       │       ├── ebtables.service.js
│       │       ├── iptables.service.js
│       │       └── rule-engine.service.js
│       └── utils/
│
├── dashboard/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/Layout.jsx
│       ├── context/AuthContext.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Sessions.jsx
│       │   ├── Devices.jsx
│       │   ├── Vouchers.jsx
│       │   ├── Firewall.jsx
│       │   ├── Logs.jsx
│       │   └── Settings.jsx
│       └── services/api.js
│
└── portal/
    ├── index.html
    ├── login.html
    ├── register.html
    ├── success.html
    ├── terms.html
    ├── css/style.css
    └── js/portal.js
```

---

## 🔒 Security Features

### Layer 2 (Data Link)
- **Client Isolation**: ebtables blocks client-to-client
- **MAC Filtering**: Only authenticated MACs allowed
- **ARP Protection**: MAC/IP binding prevents spoofing

### Layer 3 (Network)
- **Captive Redirect**: HTTP → Portal
- **DNS/DHCP Allow**: Essential services permitted
- **Default Drop**: Block all unauthenticated

### Application
- **JWT Auth**: Secure tokens
- **Rate Limiting**: Anti-brute-force
- **Input Validation**: Sanitized inputs
- **Helmet**: Security headers

---

## 🔑 Default Credentials

### Admin Dashboard
```
Username: admin
Password: admin123
```

---

## 📊 Current Progress

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Backend & Portal | ✅ Complete | 100% |
| Phase 2: Security Engine | ✅ Complete | 100% |
| Phase 3: Admin Dashboard | ✅ Complete | 100% |
| Phase 4: Network Integration | 🔜 Pending | 0% |
| Phase 5: Hardware Deployment | 🔜 Pending | 0% |
| Phase 6: Testing & Docs | 🔜 Pending | 0% |

**Overall Progress: ~50%**

---

*Last Updated: December 31, 2025*
