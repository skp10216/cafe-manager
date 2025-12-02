'use client';

/**
 * 공통 카드 컴포넌트
 */

import { Card, CardContent, CardHeader, CardActions, Typography, Box } from '@mui/material';
import { ReactNode } from 'react';

interface AppCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  sx?: object;
}

export default function AppCard({
  title,
  subtitle,
  action,
  children,
  footer,
  sx,
}: AppCardProps) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
      {(title || action) && (
        <CardHeader
          title={
            title && (
              <Typography variant="h4" component="h2">
                {title}
              </Typography>
            )
          }
          subheader={subtitle}
          action={action}
          sx={{ pb: 0 }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, pt: title ? 2 : undefined }}>
        {children}
      </CardContent>
      {footer && (
        <CardActions sx={{ px: 2, pb: 2 }}>
          {footer}
        </CardActions>
      )}
    </Card>
  );
}




