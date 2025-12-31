import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  FileText,
  Search,
  RefreshCw,
  Filter,
  ChevronDown,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Shield,
  Users,
  Activity,
  Download,
} from 'lucide-react'

const severityColors = {
  DEBUG: 'bg-slate-100 text-slate-600',
  INFO: 'bg-blue-100 text-blue-700',
  WARNING: 'bg-amber-100 text-amber-700',
  ERROR: 'bg-red-100 text-red-700',
  CRITICAL: 'bg-red-200 text-red-800',
}

const categoryIcons = {
  AUTH: Users,
  SESSION: Activity,
  SECURITY: Shield,
  FIREWALL: Shield,
  ADMIN: Users,
  SYSTEM: Activity,
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchLogs = async (reset = false) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: reset ? 1 : page,
        limit: 50,
      })
      if (category !== 'all') params.append('category', category)
      if (severity !== 'all') params.append('severity', severity)
      if (search) params.append('search', search)
      
      const data = await api.get(`/admin/logs?${params}`)
      
      if (reset) {
        setLogs(data.logs || [])
        setPage(1)
      } else {
        setLogs(prev => [...prev, ...(data.logs || [])])
      }
      setHasMore((data.logs || []).length === 50)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(true)
  }, [category, severity])

  const handleSearch = () => {
    fetchLogs(true)
  }

  const loadMore = () => {
    setPage(p => p + 1)
    fetchLogs()
  }

  const exportLogs = () => {
    const csv = [
      'Timestamp,Category,Severity,Event Type,Details',
      ...logs.map(log => 
        `${log.created_at},${log.event_category},${log.severity},${log.event_type},"${JSON.stringify(log.details || {})}"`
      )
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleString()
  }

  const getSeverityIcon = (sev) => {
    switch (sev) {
      case 'ERROR':
      case 'CRITICAL':
        return XCircle
      case 'WARNING':
        return AlertTriangle
      case 'INFO':
        return Info
      default:
        return CheckCircle
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Logs</h1>
          <p className="text-slate-500">System and security event history</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            <option value="all">All Categories</option>
            <option value="AUTH">Authentication</option>
            <option value="SESSION">Sessions</option>
            <option value="SECURITY">Security</option>
            <option value="FIREWALL">Firewall</option>
            <option value="ADMIN">Admin</option>
            <option value="SYSTEM">System</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
          >
            <option value="all">All Severities</option>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No logs found
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {logs.map((log) => {
              const Icon = categoryIcons[log.event_category] || Activity
              const SeverityIcon = getSeverityIcon(log.severity)
              
              return (
                <div key={log.id} className="px-6 py-4 hover:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900">
                          {log.event_type}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityColors[log.severity] || severityColors.INFO}`}>
                          {log.severity}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                          {log.event_category}
                        </span>
                      </div>
                      
                      {log.details && (
                        <div className="mt-2 text-sm text-slate-600">
                          {typeof log.details === 'string' 
                            ? log.details 
                            : Object.entries(JSON.parse(log.details || '{}')).map(([key, value]) => (
                                <span key={key} className="inline-block mr-4">
                                  <span className="text-slate-400">{key}:</span>{' '}
                                  <span className="font-mono">{String(value)}</span>
                                </span>
                              ))
                          }
                        </div>
                      )}
                      
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                        <span>{formatTime(log.created_at)}</span>
                        {log.mac_address && (
                          <span className="font-mono">{log.mac_address}</span>
                        )}
                        {log.ip_address && (
                          <span className="font-mono">{log.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Load More */}
        {hasMore && logs.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
