'use client';

/**
 * 공통 테이블 컴포넌트
 */

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { ReactNode } from 'react';

interface Column<T> {
  id: keyof T | string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => ReactNode;
}

interface AppTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (limit: number) => void;
  onRowClick?: (row: T) => void;
}

export default function AppTable<T extends Record<string, unknown>>({
  columns,
  rows,
  keyField,
  loading = false,
  emptyMessage = '데이터가 없습니다',
  page = 1,
  limit = 20,
  total = 0,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
}: AppTableProps<T>) {
  const handlePageChange = (_: unknown, newPage: number) => {
    onPageChange?.(newPage + 1); // MUI는 0-based, API는 1-based
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onRowsPerPageChange?.(parseInt(event.target.value, 10));
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={String(row[keyField])}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.id)} align={column.align || 'left'}>
                      {column.render
                        ? column.render(row)
                        : (row[column.id as keyof T] as ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 페이지네이션 */}
      {total > 0 && (
        <TablePagination
          component="div"
          count={total}
          page={page - 1} // MUI는 0-based
          rowsPerPage={limit}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="페이지당 행 수:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / 총 ${count}개`
          }
        />
      )}
    </Paper>
  );
}

