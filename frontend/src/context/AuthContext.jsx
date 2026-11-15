import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('issueflow_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setPermissions(data.permissions || []);
      setPosition(data.position || null);
      connectSocket(token);
    } catch (err) {
      localStorage.removeItem('issueflow_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password, organizationId) => {
    const { data } = await api.post('/auth/login', { email, password, organizationId });
    localStorage.setItem('issueflow_token', data.token);
    setUser(data.user);
    connectSocket(data.token);
    await loadMe();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('issueflow_token', data.token);
    setUser(data.user);
    connectSocket(data.token);
    await loadMe();
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('issueflow_token');
    disconnectSocket();
    setUser(null);
    setPermissions([]);
    setPosition(null);
  };

  const hasPermission = (perm) => user && (user.systemRole === 'SYSTEM_ADMIN' || permissions.includes(perm));

  return (
    <AuthContext.Provider value={{ user, permissions, position, loading, login, register, logout, hasPermission, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
