/**
 * 전역 HTTP 예외 필터
 * 모든 예외를 일관된 형식으로 변환
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** API 에러 응답 형식 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HTTP 예외인지 확인
    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // 에러 메시지 추출
    let message = '서버 오류가 발생했습니다';
    let error: string | undefined;

    if (isHttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(responseObj.message)
          ? responseObj.message.join(', ')
          : (responseObj.message as string) || message;
        error = responseObj.error as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      // 개발 환경에서만 스택 트레이스 로깅
      if (process.env.NODE_ENV !== 'production') {
        console.error('Unhandled exception:', exception.stack);
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(errorResponse);
  }
}









