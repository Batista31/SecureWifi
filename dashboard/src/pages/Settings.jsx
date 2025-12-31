import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Wifi,
  Clock,
  Shield,
  Users,
  Bell,
  Database,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react'

const SettingsSection = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <div className="flex items-start gap-4 mb-6">
      <div className="p-2 bg-primary-100 rounded-lg">
        <Icon className="w-5 h-5 text-primary-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
)

const FormField = ({ label, description, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
    <div className="sm:w-1/3">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {description && (
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      )}
    </div>
    <div className="flex-1">
      {children}
    </div>
  </div>
)

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-primary-600' : 'bg-slate-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
)

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  const [settings, setSettings] = useState({
    // Session settings
    session_timeout: 3600,
    max_devices_per_user: 3,
    session_extension_allowed: true,
    
    // Captive portal
    portal_title: 'WiFi Access',
    portal_welcome_message: 'Welcome to our network',
    terms_required: true,
    
    // Authentication
    sms_auth_enabled: true,
    voucher_auth_enabled: true,
    social_auth_enabled: false,
    
    // Security
    firewall_simulation_mode: true,
    client_isolation: true,
    mac_binding_enabled: true,
    auto_block_suspicious: false,
    
    // Rate limiting
    auth_rate_limit: 5,
    auth_rate_window: 300,
    
    // Cleanup
    log_retention_days: 30,
    session_cleanup_interval: 3600,
  })

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const data = await api.get('/admin/settings')
      setSettings(prev => ({ ...prev, ...data }))
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put('/admin/settings', settings)
      setMessage({ type: 'success', text: 'Settings saved successfully' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500">System configuration and preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Session Settings */}
      <SettingsSection
        icon={Clock}
        title="Session Settings"
        description="Configure session duration and limits"
      >
        <FormField label="Session Timeout" description="Default session duration">
          <select
            value={settings.session_timeout}
            onChange={(e) => updateSetting('session_timeout', parseInt(e.target.value))}
            className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={7200}>2 hours</option>
            <option value={14400}>4 hours</option>
            <option value={28800}>8 hours</option>
            <option value={86400}>24 hours</option>
          </select>
        </FormField>
        
        <FormField label="Max Devices per User" description="Concurrent device limit">
          <input
            type="number"
            min={1}
            max={10}
            value={settings.max_devices_per_user}
            onChange={(e) => updateSetting('max_devices_per_user', parseInt(e.target.value))}
            className="w-full sm:w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </FormField>
        
        <FormField label="Allow Session Extension" description="Users can extend their sessions">
          <Toggle
            checked={settings.session_extension_allowed}
            onChange={(v) => updateSetting('session_extension_allowed', v)}
          />
        </FormField>
      </SettingsSection>

      {/* Captive Portal */}
      <SettingsSection
        icon={Wifi}
        title="Captive Portal"
        description="Customize the login portal appearance"
      >
        <FormField label="Portal Title" description="Displayed on the login page">
          <input
            type="text"
            value={settings.portal_title}
            onChange={(e) => updateSetting('portal_title', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </FormField>
        
        <FormField label="Welcome Message" description="Greeting text for users">
          <textarea
            value={settings.portal_welcome_message}
            onChange={(e) => updateSetting('portal_welcome_message', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
          />
        </FormField>
        
        <FormField label="Require Terms Acceptance" description="Users must accept terms">
          <Toggle
            checked={settings.terms_required}
            onChange={(v) => updateSetting('terms_required', v)}
          />
        </FormField>
      </SettingsSection>

      {/* Authentication Methods */}
      <SettingsSection
        icon={Users}
        title="Authentication Methods"
        description="Enable or disable authentication options"
      >
        <FormField label="SMS Authentication" description="Login via phone number">
          <Toggle
            checked={settings.sms_auth_enabled}
            onChange={(v) => updateSetting('sms_auth_enabled', v)}
          />
        </FormField>
        
        <FormField label="Voucher Authentication" description="Login with access codes">
          <Toggle
            checked={settings.voucher_auth_enabled}
            onChange={(v) => updateSetting('voucher_auth_enabled', v)}
          />
        </FormField>
        
        <FormField label="Social Authentication" description="Login via social accounts">
          <Toggle
            checked={settings.social_auth_enabled}
            onChange={(v) => updateSetting('social_auth_enabled', v)}
          />
        </FormField>
      </SettingsSection>

      {/* Security Settings */}
      <SettingsSection
        icon={Shield}
        title="Security Settings"
        description="Configure firewall and security options"
      >
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Firewall is in simulation mode. Rules are logged but not applied.</span>
        </div>
        
        <FormField label="Simulation Mode" description="Log firewall rules without applying">
          <Toggle
            checked={settings.firewall_simulation_mode}
            onChange={(v) => updateSetting('firewall_simulation_mode', v)}
          />
        </FormField>
        
        <FormField label="Client Isolation" description="Prevent client-to-client communication">
          <Toggle
            checked={settings.client_isolation}
            onChange={(v) => updateSetting('client_isolation', v)}
          />
        </FormField>
        
        <FormField label="MAC/IP Binding" description="Bind MAC addresses to IP addresses">
          <Toggle
            checked={settings.mac_binding_enabled}
            onChange={(v) => updateSetting('mac_binding_enabled', v)}
          />
        </FormField>
        
        <FormField label="Auto-block Suspicious" description="Automatically block suspicious activity">
          <Toggle
            checked={settings.auto_block_suspicious}
            onChange={(v) => updateSetting('auto_block_suspicious', v)}
          />
        </FormField>
      </SettingsSection>

      {/* Rate Limiting */}
      <SettingsSection
        icon={Bell}
        title="Rate Limiting"
        description="Prevent abuse and brute force attacks"
      >
        <FormField label="Auth Attempts Limit" description="Max attempts before lockout">
          <input
            type="number"
            min={1}
            max={20}
            value={settings.auth_rate_limit}
            onChange={(e) => updateSetting('auth_rate_limit', parseInt(e.target.value))}
            className="w-full sm:w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </FormField>
        
        <FormField label="Rate Window (seconds)" description="Time window for rate limiting">
          <input
            type="number"
            min={60}
            max={3600}
            step={60}
            value={settings.auth_rate_window}
            onChange={(e) => updateSetting('auth_rate_window', parseInt(e.target.value))}
            className="w-full sm:w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </FormField>
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection
        icon={Database}
        title="Data Management"
        description="Log retention and cleanup settings"
      >
        <FormField label="Log Retention (days)" description="How long to keep logs">
          <input
            type="number"
            min={1}
            max={365}
            value={settings.log_retention_days}
            onChange={(e) => updateSetting('log_retention_days', parseInt(e.target.value))}
            className="w-full sm:w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </FormField>
        
        <FormField label="Cleanup Interval (seconds)" description="Session cleanup frequency">
          <select
            value={settings.session_cleanup_interval}
            onChange={(e) => updateSetting('session_cleanup_interval', parseInt(e.target.value))}
            className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value={300}>5 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
          </select>
        </FormField>
        
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Danger Zone</h3>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50">
              Clear Expired Sessions
            </button>
            <button className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50">
              Purge Old Logs
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* System Info */}
      <div className="bg-slate-50 rounded-xl p-6 text-sm text-slate-600">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4" />
          <span className="font-medium">System Information</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="block text-slate-400 text-xs">Version</span>
            <span className="font-mono">1.0.0</span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs">Database</span>
            <span className="font-mono">SQLite</span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs">Mode</span>
            <span className="font-mono">Simulation</span>
          </div>
          <div>
            <span className="block text-slate-400 text-xs">Environment</span>
            <span className="font-mono">Development</span>
          </div>
        </div>
      </div>
    </div>
  )
}
