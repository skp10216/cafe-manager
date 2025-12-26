'use client';

/**
 * 앱 헤더 바
 */

import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import { Menu as MenuIcon, AccountCircle, Logout } from '@mui/icons-material';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthToken } from '@/lib/api-client';

interface AppBarProps {
  drawerWidth: number;
  onMenuClick: () => void;
}

export default function AppBar({ drawerWidth, onMenuClick }: AppBarProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  return (
    <MuiAppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        backgroundColor: 'background.paper',
        color: 'text.primary',
      }}
    >
      <Toolbar>
        {/* 모바일 메뉴 버튼 */}
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* 타이틀 */}
        <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
          카페매니저
        </Typography>

        {/* 사용자 메뉴 */}
        <Box>
          <IconButton onClick={handleMenuOpen} size="small">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              <AccountCircle />
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={() => router.push('/settings')}>
              <AccountCircle sx={{ mr: 1 }} />내 정보
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              로그아웃
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}




