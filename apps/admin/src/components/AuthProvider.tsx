'use client';

/**
 * Admin 인증 Provider
 * 토큰 유효성 검사 및 로그인 상태 관리
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import LoginForm from './LoginForm';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 토큰 검증 및 사용자 정보 로드
  const validateToken = async (storedToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      if (!res.ok) {
        throw new Error('토큰이 유효하지 않습니다.');
      }

      const userData = await res.json();

      // 관리자 권한 확인
      if (userData.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
      }

      setUser(userData);
      setToken(storedToken);
      setIsAuthenticated(true);
    } catch (err) {
      // 토큰이 유효하지 않으면 삭제
      localStorage.removeItem('token');
      localStorage.removeItem('adminUser');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    }
  };

  // 초기 로드 시 토큰 확인
  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      validateToken(storedToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('adminUser');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  // 로그인 성공 핸들러
  const handleLoginSuccess = () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      validateToken(storedToken);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 인증되지 않은 경우 로그인 폼 표시
  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      {children}
    </AuthContext.Provider>
  );
}



