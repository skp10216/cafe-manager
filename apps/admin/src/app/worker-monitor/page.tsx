'use client';

/**
 * Worker Monitor 메인 페이지
 * 탭 기반 UI: Overview / Queues / Workers / Jobs / Incidents
 */

import { useState } from 'react';
import { Box, Tabs, Tab, Typography, alpha } from '@mui/material';
import {
  Dashboard,
  Storage,
  Memory,
  WorkOutline,
  Warning,
} from '@mui/icons-material';
import AdminLayout from '@/components/AdminLayout';
import OverviewTab from './components/OverviewTab';
import QueuesTab from './components/QueuesTab';
import WorkersTab from './components/WorkersTab';
import JobsTab from './components/JobsTab';
import IncidentsTab from './components/IncidentsTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`worker-monitor-tabpanel-${index}`}
      aria-labelledby={`worker-monitor-tab-${index}`}
      sx={{ py: 3 }}
    >
      {value === index && children}
    </Box>
  );
}

function a11yProps(index: number) {
  return {
    id: `worker-monitor-tab-${index}`,
    'aria-controls': `worker-monitor-tabpanel-${index}`,
  };
}

export default function WorkerMonitorPage() {
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <AdminLayout>
      <Box>
        {/* 페이지 헤더 */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h1"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mb: 0.5,
            }}
          >
            <Memory sx={{ fontSize: 32 }} />
            워커 모니터
          </Typography>
          <Typography variant="body2" color="text.secondary">
            BullMQ 큐 상태, 워커 현황, Job 처리 현황을 실시간으로 모니터링합니다.
          </Typography>
        </Box>

        {/* 탭 네비게이션 */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 56,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.9rem',
              },
              '& .Mui-selected': {
                fontWeight: 600,
              },
            }}
          >
            <Tab
              icon={<Dashboard sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Overview"
              {...a11yProps(0)}
            />
            <Tab
              icon={<Storage sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Queues"
              {...a11yProps(1)}
            />
            <Tab
              icon={<Memory sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Workers"
              {...a11yProps(2)}
            />
            <Tab
              icon={<WorkOutline sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Jobs"
              {...a11yProps(3)}
            />
            <Tab
              icon={<Warning sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Incidents"
              {...a11yProps(4)}
            />
          </Tabs>
        </Box>

        {/* 탭 컨텐츠 */}
        <TabPanel value={tabIndex} index={0}>
          <OverviewTab />
        </TabPanel>
        <TabPanel value={tabIndex} index={1}>
          <QueuesTab />
        </TabPanel>
        <TabPanel value={tabIndex} index={2}>
          <WorkersTab />
        </TabPanel>
        <TabPanel value={tabIndex} index={3}>
          <JobsTab />
        </TabPanel>
        <TabPanel value={tabIndex} index={4}>
          <IncidentsTab />
        </TabPanel>
      </Box>
    </AdminLayout>
  );
}

