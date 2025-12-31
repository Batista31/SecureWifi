import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Smartphone,
  Search,
  RefreshCw,
  Ban,
  CheckCircle,
  Clock,
  Activity,
  ChevronDown,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react'

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const data = await api.get('/admin/devices')
      setDevices(data.devices || [])
    } catch (err) {
      console.error('Failed to fetch devices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleBlock = async (deviceId, currentlyBlocked) => {
    const action = currentlyBlocked ? 'unblock' : 'block'
    if (!confirm(`Are you sure you want to ${action} this device?`)) return
    
    try {
      setActionLoading(deviceId)
      await api.post(`/admin/devices/${deviceId}/${action}`)
      fetchDevices()
    } catch (err) {
      alert(`Failed to ${action} device: ` + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredDevices = devices.filter(device => {
    const matchesFilter = filter === 'all' || 
      (filter === 'blocked' && device.is_blocked) ||
      (filter === 'active' && !device.is_blocked)
    
    const matchesSearch = !search || 
      device.mac_address?.toLowerCase().includes(search.toLowerCase()) ||
      device.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      device.vendor?.toLowerCase().includes(search.toLowerCase())
    
    return matchesFilter && matchesSearch
  })

  const formatTime = (date) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devices</h1>
          <p className="text-slate-500">Manage connected devices</p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Smartphone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{devices.length}</p>
              <p className="text-sm text-slate-500">Total Devices</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {devices.filter(d => !d.is_blocked).length}
              </p>
              <p className="text-sm text-slate-500">Allowed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {devices.filter(d => d.is_blocked).length}
              </p>
              <p className="text-sm text-slate-500">Blocked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by MAC, hostname, or vendor..."
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
            <option value="all">All Devices</option>
            <option value="active">Allowed Only</option>
            <option value="blocked">Blocked Only</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && devices.length === 0 ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No devices found</p>
          </div>
        ) : (
          filteredDevices.map((device) => (
            <div
              key={device.id}
              className={`bg-white rounded-xl p-5 shadow-sm border-2 transition-colors ${
                device.is_blocked ? 'border-red-200 bg-red-50/50' : 'border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    device.is_blocked ? 'bg-red-100' : 'bg-slate-100'
                  }`}>
                    <Smartphone className={`w-6 h-6 ${
                      device.is_blocked ? 'text-red-600' : 'text-slate-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-slate-900">
                      {device.mac_address}
                    </p>
                    {device.hostname && (
                      <p className="text-sm text-slate-500">{device.hostname}</p>
                    )}
                  </div>
                </div>
                {device.is_blocked && (
                  <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    Blocked
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {device.vendor && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Vendor:</span>
                    <span className="text-slate-700">{device.vendor}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">First seen: {formatTime(device.first_seen)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Last seen: {formatTime(device.last_seen)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">Sessions:</span>
                  <span className="text-slate-700">{device.total_sessions || 0}</span>
                </div>
              </div>

              {device.block_reason && (
                <div className="mb-4 p-3 bg-red-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-red-800">Block Reason</p>
                      <p className="text-sm text-red-700">{device.block_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => handleBlock(device.id, device.is_blocked)}
                disabled={actionLoading === device.id}
                className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  device.is_blocked
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                } disabled:opacity-50`}
              >
                {actionLoading === device.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : device.is_blocked ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Unblock Device
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Block Device
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
