import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('adminToken')
    if (token) {
      api.setToken(token)
      // Verify token is still valid
      api.get('/admin/me')
        .then(data => {
          setUser(data)
        })
        .catch(() => {
          localStorage.removeItem('adminToken')
          api.setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const data = await api.post('/admin/login', { username, password })
    if (data.success) {
      localStorage.setItem('adminToken', data.token)
      api.setToken(data.token)
      setUser(data.admin)
      return { success: true }
    }
    return { success: false, message: data.message }
  }

  const logout = () => {
    localStorage.removeItem('adminToken')
    api.setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
