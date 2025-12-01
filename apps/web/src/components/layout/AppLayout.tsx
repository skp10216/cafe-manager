'use client';

/**
 * 앱 레이아웃
 * AppBar + NavDrawer + Content Area
 */

import { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import AppBar from './AppBar';
import NavDrawer from './NavDrawer';

const DRAWER_WIDTH = 260;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* 앱바 */}
      <AppBar
        drawerWidth={DRAWER_WIDTH}
        onMenuClick={handleDrawerToggle}
      />

      {/* 네비게이션 드로어 */}
      <NavDrawer
        width={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={handleDrawerToggle}
      />

      {/* 메인 콘텐츠 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          mt: '64px', // AppBar 높이
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

