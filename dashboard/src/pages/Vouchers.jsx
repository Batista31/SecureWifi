import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Ticket,
  Search,
  RefreshCw,
  Plus,
  Copy,
  Trash2,
  Clock,
  Users,
  ChevronDown,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react'

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newVoucher, setNewVoucher] = useState({
    count: 1,
    duration: 4,
    maxDevices: 2,
    prefix: '',
  })
  const [createdCodes, setCreatedCodes] = useState([])

  const fetchVouchers = async () => {
    try {
      setLoading(true)
      const data = await api.get('/admin/vouchers')
      setVouchers(data.vouchers || [])
    } catch (err) {
      console.error('Failed to fetch vouchers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVouchers()
  }, [])

  const handleCreate = async () => {
    try {
      setCreating(true)
      const data = await api.post('/admin/vouchers', newVoucher)
      setCreatedCodes(data.codes || [])
      fetchVouchers()
    } catch (err) {
      alert('Failed to create vouchers: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (voucherId) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return
    
    try {
      await api.delete(`/admin/vouchers/${voucherId}`)
      fetchVouchers()
    } catch (err) {
      alert('Failed to delete voucher: ' + err.message)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // Could add a toast notification here
  }

  const exportVouchers = () => {
    const csv = [
      'Code,Duration (hours),Max Devices,Created,Status,Used At',
      ...filteredVouchers.map(v => 
        `${v.code},${v.duration_hours},${v.max_devices},${v.created_at},${v.is_active ? 'Active' : 'Inactive'},${v.used_at || ''}`
      )
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vouchers.csv'
    a.click()
  }

  const filteredVouchers = vouchers.filter(voucher => {
    const matchesFilter = filter === 'all' || 
      (filter === 'active' && voucher.is_active && !voucher.used_at) ||
      (filter === 'used' && voucher.used_at) ||
      (filter === 'inactive' && !voucher.is_active)
    
    const matchesSearch = !search || 
      voucher.code?.toLowerCase().includes(search.toLowerCase())
    
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
          <h1 className="text-2xl font-bold text-slate-900">Vouchers</h1>
          <p className="text-slate-500">Generate and manage access vouchers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportVouchers}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Generate Vouchers
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Ticket className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{vouchers.length}</p>
              <p className="text-sm text-slate-500">Total</p>
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
                {vouchers.filter(v => v.is_active && !v.used_at).length}
              </p>
              <p className="text-sm text-slate-500">Available</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {vouchers.filter(v => v.used_at).length}
              </p>
              <p className="text-sm text-slate-500">Used</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <XCircle className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {vouchers.filter(v => !v.is_active).length}
              </p>
              <p className="text-sm text-slate-500">Inactive</p>
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
            placeholder="Search voucher codes..."
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
            <option value="active">Available</option>
            <option value="used">Used</option>
            <option value="inactive">Inactive</option>
            <option value="all">All Vouchers</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <button
          onClick={fetchVouchers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Max Devices
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Used At
                </th>
                <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && vouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-slate-400" />
                    Loading vouchers...
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Ticket className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No vouchers found
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="px-3 py-1 bg-slate-100 rounded-lg font-mono text-sm font-medium">
                          {voucher.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(voucher.code)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {voucher.duration_hours} hours
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Users className="w-4 h-4 text-slate-400" />
                        {voucher.max_devices}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        !voucher.is_active
                          ? 'bg-slate-100 text-slate-600'
                          : voucher.used_at
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {!voucher.is_active
                          ? 'Inactive'
                          : voucher.used_at
                          ? 'In Use'
                          : 'Available'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {voucher.used_at ? formatTime(voucher.used_at) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(voucher.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete voucher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Generate Vouchers</h2>
              <p className="text-sm text-slate-500 mt-1">Create new access vouchers</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Number of Vouchers
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newVoucher.count}
                  onChange={(e) => setNewVoucher({ ...newVoucher, count: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duration (hours)
                </label>
                <select
                  value={newVoucher.duration}
                  onChange={(e) => setNewVoucher({ ...newVoucher, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={8}>8 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (1 day)</option>
                  <option value={72}>72 hours (3 days)</option>
                  <option value={168}>168 hours (1 week)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Devices per Voucher
                </label>
                <select
                  value={newVoucher.maxDevices}
                  onChange={(e) => setNewVoucher({ ...newVoucher, maxDevices: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                >
                  <option value={1}>1 device</option>
                  <option value={2}>2 devices</option>
                  <option value={3}>3 devices</option>
                  <option value={5}>5 devices</option>
                  <option value={10}>10 devices</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Code Prefix (optional)
                </label>
                <input
                  type="text"
                  value={newVoucher.prefix}
                  onChange={(e) => setNewVoucher({ ...newVoucher, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g., GUEST, VIP"
                  maxLength={6}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              {createdCodes.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Created {createdCodes.length} voucher(s):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {createdCodes.map(code => (
                      <code key={code} className="px-2 py-1 bg-white rounded text-sm font-mono">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreatedCodes([])
                }}
                className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {createdCodes.length > 0 ? 'Close' : 'Cancel'}
              </button>
              {createdCodes.length === 0 && (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
