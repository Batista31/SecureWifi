import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Users,
  Search,
  RefreshCw,
  XCircle,
  Clock,
  Wifi,
  Globe,
  Shield,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [disconnecting, setDisconnecting] = useState(null)

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const data = await api.get('/admin/sessions')
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleDisconnect = async (sessionId) => {
    if (!confirm('Are you sure you want to disconnect this session?')) return
    
    try {
      setDisconnecting(sessionId)
      await api.delete(`/admin/sessions/${sessionId}`)
      fetchSessions()
    } catch (err) {
      alert('Failed to disconnect session: ' + err.message)
    } finally {
      setDisconnecting(null)
    }
  }

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && session.is_active) ||
      (filter === 'expired' && !session.is_active)
    
    const matchesSearch = !search || 
      session.mac_address?.toLowerCase().includes(search.toLowerCase()) ||
      session.ip_address?.includes(search)
    
    return matchesFilter && matchesSearch
  })

  const formatTime = (date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString()
  }

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'N/A'
    const diff = new Date(expiresAt) - new Date()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${mins}m`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
          <p className="text-slate-500">Manage active and past sessions</p>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by MAC or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            <option value="active">Active Only</option>
            <option value="expired">Expired</option>
            <option value="all">All Sessions</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Auth Method
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Time Remaining
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
                    Loading sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No sessions found
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Wifi className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 font-mono text-sm">
                            {session.mac_address}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {session.ip_address}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        session.auth_method === 'voucher'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {session.auth_method === 'voucher' ? '🎫' : '👤'}
                        {session.auth_method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatTime(session.started_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className={`text-sm ${
                          session.is_active ? 'text-slate-900' : 'text-slate-400'
                        }`}>
                          {getTimeRemaining(session.expires_at)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        session.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {session.is_active ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Active
                          </>
                        ) : (
                          'Expired'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {session.is_active && (
                        <button
                          onClick={() => handleDisconnect(session.id)}
                          disabled={disconnecting === session.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {disconnecting === session.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Disconnect
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Showing {filteredSessions.length} of {sessions.length} sessions
          </p>
        </div>
      </div>
    </div>
  )
}
