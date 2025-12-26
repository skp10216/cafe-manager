'use client';

/**
 * Admin 레이아웃 컴포넌트
 * 사이드바 네비게이션 + 콘텐츠 영역
 */

import { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard,
  Schedule,
  Link as LinkIcon,
  People,
  History,
  Settings,
  Logout,
  Menu as MenuIcon,
  AdminPanelSettings,
} from '@mui/icons-material';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const DRAWER_WIDTH = 260;

/** 네비게이션 메뉴 항목 */
const NAV_ITEMS = [
  { label: '대시보드', icon: Dashboard, href: '/' },
  { label: '스케줄 승인', icon: Schedule, href: '/schedules' },
  { label: '세션 모니터', icon: LinkIcon, href: '/sessions' },
  { label: '사용자 관리', icon: People, href: '/users' },
  { label: '감사 로그', icon: History, href: '/audit' },
  { label: '정책 설정', icon: Settings, href: '/policies' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 로고/타이틀 */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 40,
            height: 40,
          }}
        >
          <AdminPanelSettings />
        </Avatar>
        <Box>
          <Typography
            variant="h3"
            sx={{ fontWeight: 700, color: 'text.primary' }}
          >
            카페매니저
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Admin Console
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'divider' }} />

      {/* 네비게이션 */}
      <List sx={{ flex: 1, px: 1.5, py: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.dark',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'primary.light' : 'text.secondary',
                  }}
                >
                  <item.icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'primary.light' : 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'divider' }} />

      {/* 하단 로그아웃 */}
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            '&:hover': {
              bgcolor: 'error.dark',
              '& .MuiListItemIcon-root': {
                color: 'error.light',
              },
              '& .MuiListItemText-primary': {
                color: 'error.light',
              },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="로그아웃"
            primaryTypographyProps={{
              fontWeight: 500,
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 모바일 햄버거 버튼 */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1300,
          display: { md: 'none' },
        }}
      >
        <Tooltip title="메뉴">
          <IconButton
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 사이드바 - 모바일 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* 사이드바 - 데스크톱 */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* 메인 콘텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          ml: { md: `${DRAWER_WIDTH}px` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}


