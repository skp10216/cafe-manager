'use client';

/**
 * Incident Banner
 * Overview에서 Active Incidents를 배너 형태로 표시
 */

import { Box, Typography, Button, Chip, IconButton, Collapse, alpha } from '@mui/material';
import {
  Warning,
  Error as ErrorIcon,
  Info,
  ExpandMore,
  ExpandLess,
  CheckCircle,
} from '@mui/icons-material';
import { useState } from 'react';

interface Incident {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  queueName?: string;
  title: string;
  description?: string;
  recommendedAction?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  startedAt: string;
  affectedJobs: number;
}

interface IncidentBannerProps {
  incidents: Incident[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

const severityConfig = {
  CRITICAL: { icon: ErrorIcon, color: '#d32f2f', bg: 'rgba(211, 47, 47, 0.1)', label: '심각' },
  HIGH: { icon: ErrorIcon, color: '#f57c00', bg: 'rgba(245, 124, 0, 0.1)', label: '높음' },
  MEDIUM: { icon: Warning, color: '#fbc02d', bg: 'rgba(251, 192, 45, 0.1)', label: '보통' },
  LOW: { icon: Info, color: '#1976d2', bg: 'rgba(25, 118, 210, 0.1)', label: '낮음' },
};

function getRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function IncidentBanner({
  incidents,
  onAcknowledge,
  onResolve,
}: IncidentBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!incidents || incidents.length === 0) {
    return null;
  }

  // 가장 심각한 Incident 찾기
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const sortedIncidents = [...incidents].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  const topIncident = sortedIncidents[0];
  const config = severityConfig[topIncident.severity] || severityConfig.MEDIUM;
  const IconComponent = config.icon;

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: 2,
        border: `1px solid ${alpha(config.color, 0.3)}`,
        bgcolor: config.bg,
        overflow: 'hidden',
      }}
    >
      {/* 메인 배너 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          cursor: incidents.length > 1 ? 'pointer' : 'default',
        }}
        onClick={() => incidents.length > 1 && setExpanded(!expanded)}
      >
        <IconComponent sx={{ color: config.color, fontSize: 28 }} />

        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={700} color={config.color}>
              {topIncident.title}
            </Typography>
            <Chip
              size="small"
              label={config.label}
              sx={{
                bgcolor: alpha(config.color, 0.2),
                color: config.color,
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
            {topIncident.status === 'ACKNOWLEDGED' && (
              <Chip
                size="small"
                label="확인됨"
                icon={<CheckCircle sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: alpha('#4caf50', 0.2),
                  color: '#4caf50',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                }}
              />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {topIncident.description}
            {topIncident.affectedJobs > 0 && ` • 영향받는 작업: ${topIncident.affectedJobs}개`}
            {' • '}
            {getRelativeTime(topIncident.startedAt)}
          </Typography>
          {topIncident.recommendedAction && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              💡 {topIncident.recommendedAction}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {topIncident.status === 'ACTIVE' && onAcknowledge && (
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(topIncident.id);
              }}
              sx={{
                borderColor: config.color,
                color: config.color,
                '&:hover': {
                  borderColor: config.color,
                  bgcolor: alpha(config.color, 0.1),
                },
              }}
            >
              확인
            </Button>
          )}
          {topIncident.status !== 'RESOLVED' && onResolve && (
            <Button
              size="small"
              variant="contained"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(topIncident.id);
              }}
              sx={{
                bgcolor: config.color,
                '&:hover': { bgcolor: alpha(config.color, 0.8) },
              }}
            >
              해결
            </Button>
          )}
          {incidents.length > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
              <Chip
                size="small"
                label={`+${incidents.length - 1}`}
                sx={{
                  bgcolor: alpha(config.color, 0.2),
                  color: config.color,
                  fontWeight: 600,
                }}
              />
              <IconButton size="small">
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>

      {/* 추가 Incidents (접힘/펼침) */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: `1px solid ${alpha(config.color, 0.2)}` }}>
          {sortedIncidents.slice(1).map((incident) => {
            const incConfig = severityConfig[incident.severity] || severityConfig.MEDIUM;
            const IncIcon = incConfig.icon;

            return (
              <Box
                key={incident.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderBottom: `1px solid ${alpha(config.color, 0.1)}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <IncIcon sx={{ color: incConfig.color, fontSize: 24 }} />

                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600} color={incConfig.color}>
                      {incident.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={incConfig.label}
                      sx={{
                        bgcolor: alpha(incConfig.color, 0.2),
                        color: incConfig.color,
                        fontWeight: 500,
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                    {incident.status === 'ACKNOWLEDGED' && (
                      <Chip
                        size="small"
                        label="확인됨"
                        sx={{
                          bgcolor: alpha('#4caf50', 0.2),
                          color: '#4caf50',
                          fontWeight: 500,
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {incident.description}
                    {' • '}
                    {getRelativeTime(incident.startedAt)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {incident.status === 'ACTIVE' && onAcknowledge && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => onAcknowledge(incident.id)}
                      sx={{ color: incConfig.color, minWidth: 'auto', px: 1 }}
                    >
                      확인
                    </Button>
                  )}
                  {incident.status !== 'RESOLVED' && onResolve && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => onResolve(incident.id)}
                      sx={{ color: incConfig.color, minWidth: 'auto', px: 1 }}
                    >
                      해결
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}



