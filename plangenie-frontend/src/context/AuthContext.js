
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const API_BASE = process.env.REACT_APP_API_URL || '';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser({ token });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/login`, { email, password });
      const { token } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser({ token });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  const signup = async (email, password) => {
    try {
      await axios.post(`${API_BASE}/signup`, { email, password });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Signup failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const requestOTP = async (to) => {
    try {
      await axios.post(`${API_BASE}/otp/request`, { to });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'OTP request failed' };
    }
  };

  const verifyOTP = async (to, code) => {
    try {
      const response = await axios.post(`${API_BASE}/otp/verify`, { to, code });
      const { token } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser({ token });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'OTP verification failed' };
    }
  };

  const value = {
    user,
    login,
    signup,
    logout,
    requestOTP,
    verifyOTP,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
