const API_BASE = '/api'

let authToken = null

const api = {
  setToken(token) {
    authToken = token
  },

  async request(method, endpoint, body = null) {
    const headers = {
      'Content-Type': 'application/json',
    }
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const options = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options)
    
    // Handle empty responses
    const text = await response.text()
    let data = {}
    
    if (text) {
      try {
        data = JSON.parse(text)
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
      }
    }
    
    if (!response.ok) {
      throw new Error(data.message || data.error || `Request failed with status ${response.status}`)
    }
    
    return data
  },

  get(endpoint) {
    return this.request('GET', endpoint)
  },

  post(endpoint, body) {
    return this.request('POST', endpoint, body)
  },

  put(endpoint, body) {
    return this.request('PUT', endpoint, body)
  },

  delete(endpoint) {
    return this.request('DELETE', endpoint)
  },
}

export default api
