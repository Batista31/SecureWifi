import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Shield,
  RefreshCw,
  Network,
  Layers,
  Link2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Play,
  Square,
  Eye,
  Lock,
} from 'lucide-react'

// Collapsible section component
function RuleSection({ title, icon: Icon, rules, color }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500">{rules?.length || 0} rules</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-200">
          {!rules || rules.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">
              <Shield className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No rules in this category</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((rule, index) => (
                <div key={index} className="px-6 py-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-slate-600 font-mono break-all block">
                        {rule.rule_command || rule.command || rule}
                      </code>
                      {rule.description && (
                        <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
                      rule.action === 'ACCEPT' || rule.action === 'ALLOW'
                        ? 'bg-green-100 text-green-700'
                        : rule.action === 'DROP' || rule.action === 'BLOCK'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {rule.action || rule.rule_action || 'RULE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Binding card component
function BindingCard({ binding }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-600" />
          <span className="font-medium text-slate-900">MAC/IP Binding</span>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
          binding.is_active
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {binding.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">MAC:</span>
          <code className="font-mono text-slate-700">{binding.mac_address}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">IP:</span>
          <code className="font-mono text-slate-700">{binding.ip_address}</code>
        </div>
        {binding.session_id && (
          <div className="flex justify-between">
            <span className="text-slate-500">Session:</span>
            <span className="text-slate-700">#{binding.session_id}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Firewall() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get('/firewall/status')
      setStatus(data.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleTestAccess = async () => {
    setTesting(true)
    try {
      const result = await api.post('/firewall/grant', {
        macAddress: 'DE:AD:BE:EF:CA:FE',
        ipAddress: '192.168.4.200',
        authMethod: 'test',
      })
      setTestResult(result)
    } catch (err) {
      setTestResult({ error: err.message })
    } finally {
      setTesting(false)
    }
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Firewall</h1>
          <p className="text-slate-500">Security rules and client isolation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestAccess}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Test Grant Access
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {testResult && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          testResult.error
            ? 'bg-red-50 border border-red-200'
            : 'bg-green-50 border border-green-200'
        }`}>
          {testResult.error ? (
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          )}
          <div>
            <p className={`font-medium ${testResult.error ? 'text-red-800' : 'text-green-800'}`}>
              {testResult.error ? 'Test Failed' : 'Test Access Granted'}
            </p>
            <p className="text-sm mt-1 text-slate-600">
              {testResult.error || `Generated ${testResult.data?.steps?.length || 0} firewall steps`}
            </p>
            <button
              onClick={() => setTestResult(null)}
              className="text-sm text-slate-500 hover:text-slate-700 mt-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">Mode</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              status?.mode === 'simulation'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {status?.mode || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {status?.mode === 'simulation' ? (
              <Eye className="w-6 h-6 text-amber-500" />
            ) : (
              <Shield className="w-6 h-6 text-green-500" />
            )}
            <span className="text-lg font-semibold text-slate-900">
              {status?.mode === 'simulation' ? 'Simulation' : 'Production'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">iptables Rules</span>
            <Network className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {status?.iptables?.activeRules || 0}
          </p>
          <p className="text-sm text-slate-500">Layer 3 (IP)</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">ebtables Rules</span>
            <Layers className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {status?.ebtables?.activeRules || 0}
          </p>
          <p className="text-sm text-slate-500">Layer 2 (Ethernet)</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">MAC/IP Bindings</span>
            <Link2 className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {status?.bindings?.active || 0}
          </p>
          <p className="text-sm text-slate-500">Active bindings</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'iptables', label: 'iptables' },
            { id: 'ebtables', label: 'ebtables' },
            { id: 'bindings', label: 'Bindings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Simulation Mode Info */}
          {status?.mode === 'simulation' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Simulation Mode Active</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Firewall rules are being generated and logged but not applied to the system.
                    Switch to production mode on Raspberry Pi to enforce rules via iptables/ebtables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Security Features */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Security Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Client Isolation</p>
                  <p className="text-sm text-slate-500">Prevents clients from communicating directly</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">ARP Spoofing Protection</p>
                  <p className="text-sm text-slate-500">Blocks ARP spoofing attempts</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">MAC/IP Binding</p>
                  <p className="text-sm text-slate-500">Enforces device identity verification</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Session-Based Access</p>
                  <p className="text-sm text-slate-500">Rules automatically expire with sessions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cleanup Status */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Cleanup Scheduler</h3>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                status?.cleanupRunning ? 'bg-green-100' : 'bg-slate-100'
              }`}>
                {status?.cleanupRunning ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Square className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {status?.cleanupRunning ? 'Running' : 'Stopped'}
                </p>
                <p className="text-sm text-slate-500">
                  Interval: {(status?.config?.cleanupInterval || 60000) / 1000}s
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'iptables' && (
        <RuleSection
          title="iptables Rules (Layer 3)"
          icon={Network}
          rules={status?.iptables?.rules}
          color="bg-blue-500"
        />
      )}

      {activeTab === 'ebtables' && (
        <RuleSection
          title="ebtables Rules (Layer 2)"
          icon={Layers}
          rules={status?.ebtables?.rules}
          color="bg-purple-500"
        />
      )}

      {activeTab === 'bindings' && (
        <div className="space-y-4">
          {!status?.bindings?.list || status.bindings.list.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm text-center">
              <Link2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No active MAC/IP bindings</p>
              <p className="text-sm text-slate-400 mt-1">
                Bindings are created when users authenticate
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {status.bindings.list.map((binding, index) => (
                <BindingCard key={index} binding={binding} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
