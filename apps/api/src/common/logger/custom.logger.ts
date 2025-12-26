/**
 * Custom Logger
 * 불필요한 NestJS 내부 로그를 필터링하는 커스텀 로거
 */

import { ConsoleLogger, LogLevel } from '@nestjs/common';

// 필터링할 로그 컨텍스트 목록
const FILTERED_CONTEXTS = [
  'InstanceLoader',
  'RouterExplorer',
  'RoutesResolver',
];

export class CustomLogger extends ConsoleLogger {
  /**
   * 특정 컨텍스트의 로그를 필터링
   */
  log(message: unknown, context?: string): void {
    if (context && FILTERED_CONTEXTS.includes(context)) {
      return; // 필터링된 컨텍스트는 출력하지 않음
    }
    super.log(message, context);
  }

  /**
   * 에러 로그는 항상 출력
   */
  error(message: unknown, stackOrContext?: string): void {
    super.error(message, stackOrContext);
  }

  /**
   * 경고 로그는 항상 출력
   */
  warn(message: unknown, context?: string): void {
    super.warn(message, context);
  }

  /**
   * 디버그 로그도 필터링 적용
   */
  debug(message: unknown, context?: string): void {
    if (context && FILTERED_CONTEXTS.includes(context)) {
      return;
    }
    super.debug(message, context);
  }

  /**
   * Verbose 로그도 필터링 적용
   */
  verbose(message: unknown, context?: string): void {
    if (context && FILTERED_CONTEXTS.includes(context)) {
      return;
    }
    super.verbose(message, context);
  }
}

