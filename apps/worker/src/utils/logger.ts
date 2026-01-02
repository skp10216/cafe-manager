/**
 * Winston 기반 로거
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// 커스텀 로그 포맷
const logFormat = printf(({ level, message, timestamp, context, ...meta }) => {
  const contextStr = context ? `[${context}]` : '';
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} ${level} ${contextStr} ${message} ${metaStr}`.trim();
});

// 기본 로거 생성
export function createLogger(context?: string) {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
    defaultMeta: { context },
    transports: [
      // 콘솔 출력
      new winston.transports.Console({
        format: combine(
          colorize({ all: true }),
          timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          logFormat
        ),
      }),
      // 파일 출력 (에러만)
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      // 파일 출력 (전체)
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  });

  return logger;
}

export default createLogger();













