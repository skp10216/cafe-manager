'use client';

/**
 * 네비게이션 드로어
 */

import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Dashboard,
  Description,
  Schedule,
  Article,
  History,
  Settings,
  Link as LinkIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';

interface NavDrawerProps {
  width: number;
  mobileOpen: boolean;
  onClose: () => void;
}

/** 네비게이션 메뉴 항목 */
const menuItems = [
  { path: '/', label: '대시보드', icon: Dashboard },
  { path: '/templates', label: '템플릿', icon: Description },
  { path: '/schedules', label: '스케줄', icon: Schedule },
  { path: '/posts', label: '게시글 관리', icon: Article },
  { path: '/logs', label: '작업 로그', icon: History },
  { path: '/settings', label: '설정', icon: Settings },
];

export default function NavDrawer({ width, mobileOpen, onClose }: NavDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile) {
      onClose();
    }
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 로고 영역 */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LinkIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          카페매니저
        </Typography>
      </Box>

      {/* 메뉴 목록 */}
      <List sx={{ flexGrow: 1, px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isActive =
            pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  borderRadius: 2,
                  backgroundColor: isActive ? 'primary.main' : 'transparent',
                  color: isActive ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? 'primary.contrastText' : 'text.secondary',
                  }}
                >
                  <Icon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* 푸터 */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          © 2024 카페매니저
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* 모바일 드로어 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 데스크톱 드로어 */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width,
            boxSizing: 'border-box',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}


