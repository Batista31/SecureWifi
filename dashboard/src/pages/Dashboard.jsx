import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import {
  Users,
  Smartphone,
  Ticket,
  Shield,
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Wifi,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// Stats card component
function StatCard({ title, value, icon: Icon, change, changeType, color, link }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${changeType === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 inline ${changeType === 'down' ? 'rotate-180' : ''}`} />
              {' '}{change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {link && (
        <Link to={link} className="inline-flex items-center gap-1 text-sm text-primary-600 mt-4 hover:underline">
          View all <ArrowUpRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}

// Recent activity item
function ActivityItem({ type, message, time, status }) {
  const icons = {
    auth: Users,
    device: Smartphone,
    firewall: Shield,
    system: Activity,
  }
  const Icon = icons[type] || Activity

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg">
      <div className={`p-2 rounded-lg ${
        status === 'success' ? 'bg-green-100 text-green-600' :
        status === 'warning' ? 'bg-amber-100 text-amber-600' :
        status === 'error' ? 'bg-red-100 text-red-600' :
        'bg-slate-100 text-slate-600'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">{message}</p>
        <p className="text-xs text-slate-400 mt-1">{time}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const [monitoring, firewall, health] = await Promise.all([
        api.get('/admin/monitoring/stats'),
        api.get('/firewall/status').catch(() => null),
        api.get('/health'),
      ])
      
      setStats({
        sessions: monitoring.data?.activeSessions || 0,
        devices: monitoring.data?.totalDevices || 0,
        vouchers: monitoring.data?.activeVouchers || 0,
        firewallRules: (firewall?.data?.iptables?.activeRules || 0) + (firewall?.data?.ebtables?.activeRules || 0),
        mode: health.mode,
        uptime: health.uptime,
        recentActivity: monitoring.data?.recentActivity || [],
        sessionHistory: monitoring.data?.sessionHistory || [],
        authMethods: monitoring.data?.authMethods || {},
      })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Sample data for charts (will be replaced with real data)
  const sessionChartData = stats?.sessionHistory?.length > 0 
    ? stats.sessionHistory 
    : [
        { time: '00:00', sessions: 2 },
        { time: '04:00', sessions: 1 },
        { time: '08:00', sessions: 5 },
        { time: '12:00', sessions: 8 },
        { time: '16:00', sessions: 12 },
        { time: '20:00', sessions: 6 },
        { time: '24:00', sessions: 3 },
      ]

  const authMethodData = [
    { name: 'Voucher', value: stats?.authMethods?.voucher || 65, color: '#3b82f6' },
    { name: 'User Login', value: stats?.authMethods?.user || 35, color: '#8b5cf6' },
  ]

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Overview of your WiFi captive portal</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Sessions"
          value={stats?.sessions || 0}
          icon={Users}
          color="blue"
          link="/sessions"
        />
        <StatCard
          title="Known Devices"
          value={stats?.devices || 0}
          icon={Smartphone}
          color="green"
          link="/devices"
        />
        <StatCard
          title="Active Vouchers"
          value={stats?.vouchers || 0}
          icon={Ticket}
          color="purple"
          link="/vouchers"
        />
        <StatCard
          title="Firewall Rules"
          value={stats?.firewallRules || 0}
          icon={Shield}
          color="amber"
          link="/firewall"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Activity Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Session Activity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sessionChartData}>
                <defs>
                  <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#sessionGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Auth Methods Pie Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Auth Methods</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={authMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {authMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {authMethodData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-sm text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">System Status</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Backend Server</span>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Online</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">Database</span>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-slate-700">Firewall</span>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded">Simulation</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-500" />
                <span className="text-slate-700">Uptime</span>
              </div>
              <span className="text-sm text-slate-600">
                {stats?.uptime ? `${Math.floor(stats.uptime / 60)} minutes` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <Link to="/logs" className="text-sm text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-1">
            <ActivityItem
              type="auth"
              message="New session started via voucher"
              time="2 minutes ago"
              status="success"
            />
            <ActivityItem
              type="firewall"
              message="Firewall rules updated (simulation)"
              time="5 minutes ago"
              status="success"
            />
            <ActivityItem
              type="device"
              message="New device connected"
              time="10 minutes ago"
              status="success"
            />
            <ActivityItem
              type="system"
              message="Server started"
              time="15 minutes ago"
              status="success"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
