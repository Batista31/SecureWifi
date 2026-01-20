# Secure Public Wi-Fi Access System
## Captive Portal Authentication with Layer-2 Client Isolation

An academic project demonstrating secure public Wi-Fi implementation with captive portal authentication, MAC/IP binding, and client isolation.

---

## 🎯 Project Overview

This system provides:
- **Captive Portal Authentication** - Voucher codes and user registration
- **Layer-2 Client Isolation** - Prevent device-to-device attacks
- **MAC/IP Binding** - Security enforcement after authentication
- **Admin Dashboard** - Real-time monitoring and control
- **Security Validation** - ARP spoofing and MITM test scenarios

## 🏗️ Project Structure

```
wifi-captive-portal/
├── backend/                  # Node.js/Express backend
│   ├── src/
│   │   ├── app.js           # Main application entry
│   │   ├── config/          # Configuration files
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   └── database/            # SQLite database
├── portal/                   # Captive portal (HTML/CSS/JS)
│   ├── index.html           # Landing page
│   ├── login.html           # Voucher/login page
│   ├── register.html        # Registration page
│   ├── success.html         # Post-auth success page
│   ├── css/                 # Styles
│   └── js/                  # Client-side JavaScript
├── dashboard/               # React admin dashboard (Phase 3)
├── hardware/                # Hardware configs (Phase 5)
└── scripts/                 # Deployment scripts (Phase 4)
```

## 🚀 Quick Start

> **🍓 Raspberry Pi Users:** Check out [DEPLOY_ON_PI.md](./DEPLOY_ON_PI.md) for full hardware deployment instructions.

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Installation

1. **Navigate to project directory:**
   ```bash
   cd wifi-captive-portal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize database:**
   ```bash
   npm run init-db
   ```

4. **Start the server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the portal:**
   - Captive Portal: http://localhost:3000/portal
   - API Health: http://localhost:3000/api/health

## 🔑 Default Credentials

### Admin Dashboard
- Username: `admin`
- Password: `admin123`

### Test Voucher Codes
- `TEST1234` - 4 hours, 2 devices
- `DEMO5678` - 8 hours, 1 device  
- `WIFI2024` - 24 hours, 3 devices

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/voucher` | Authenticate with voucher code |
| POST | `/api/auth/login` | Authenticate with username/password |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/validate` | Validate session token |
| POST | `/api/auth/logout` | End session |

### Portal
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portal/status` | Check authentication status |
| GET | `/api/portal/info` | Get portal information |
| GET | `/api/portal/client-info` | Get client MAC/IP info |

### Admin (Requires Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/dashboard` | Dashboard overview data |
| GET | `/api/admin/sessions` | List active sessions |
| DELETE | `/api/admin/sessions/:id` | Disconnect session |
| GET | `/api/admin/devices` | List all devices |
| POST | `/api/admin/devices/:mac/block` | Block a device |
| GET | `/api/admin/vouchers` | List vouchers |
| POST | `/api/admin/vouchers` | Generate vouchers |
| GET | `/api/admin/logs` | View event logs |

## 🛠️ Development Mode

The system runs in **simulation mode** by default, which means:
- Firewall rules are logged but NOT applied
- MAC addresses are simulated for testing
- No actual network changes are made

Set `SECURITY_MODE=production` in `.env` for real enforcement.

## 📋 Implementation Phases

- [x] **Phase 1** - Core backend, auth system, captive portal UI
- [ ] **Phase 2** - Security automation (firewall simulation)
- [ ] **Phase 3** - Admin dashboard (React)
- [ ] **Phase 4** - Integration readiness
- [ ] **Phase 5** - Hardware integration (Raspberry Pi)
- [ ] **Phase 6** - Testing and validation

## 🔒 Security Features

1. **Session Management**
   - JWT-based tokens
   - Configurable session duration
   - Device limits per user

2. **MAC/IP Binding**
   - Binds authenticated MAC to assigned IP
   - Prevents IP spoofing

3. **Client Isolation** (Phase 5)
   - ebtables rules to block inter-client traffic
   - ARP spoofing protection

4. **Logging & Auditing**
   - Comprehensive event logging
   - Security event tracking

## 📖 Academic Documentation

Key concepts for viva preparation:

1. **Captive Portal Detection**
   - How devices detect captive portals
   - HTTP redirect vs DNS hijacking

2. **Layer-2 vs Layer-3 Security**
   - Why L2 isolation is necessary
   - ebtables vs iptables

3. **MAC/IP Binding**
   - ARP table management
   - Binding enforcement

4. **Attack Vectors**
   - ARP spoofing
   - MITM attacks
   - Rogue DHCP

## 🐛 Troubleshooting

**Database errors:**
```bash
# Delete and reinitialize
rm backend/database/captive_portal.db
npm run init-db
```

**Port already in use:**
```bash
# Change port in .env
PORT=3001
```

**CORS issues:**
Check that your frontend URL is in the CORS whitelist in `app.js`.

## 📝 License

MIT License - Academic Project

---

*Developed as an academic project for demonstrating secure public WiFi implementation.*
