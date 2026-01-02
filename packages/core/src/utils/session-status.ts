/**
 * 세션 상태 판단 유틸리티 (SSOT)
 * 
 * 프로젝트 전역에서 네이버 세션 상태를 판단할 때 이 함수들만 사용해야 합니다.
 * Settings / Schedules / API / Worker 어디서든 동일한 기준으로 상태를 판단합니다.
 */

import { SESSION_STATUS } from '../constants/index.js';

// ============================================
// 타입 정의
// ============================================

/** 세션 상태 타입 (Prisma NaverSession.status와 일치) */
export type SessionStatusType =
  | 'PENDING'
  | 'HEALTHY'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'CHALLENGE_REQUIRED'
  | 'ERROR';

/** 연동 상태 타입 (대시보드 API 응답용) */
export type IntegrationStatusType =
  | 'OK'              // 정상 (자동 실행 가능)
  | 'WARNING'         // 주의 (곧 만료/확인 필요)
  | 'ACTION_REQUIRED' // 조치 필요 (재연동 필요)
  | 'NOT_CONNECTED';  // 미연결

/** 세션 상태 판단 결과 */
export interface SessionHealthResult {
  /** 정상 실행 가능 여부 (글쓰기, 스케줄 등) */
  isHealthy: boolean;
  /** 연동 상태 타입 */
  integrationType: IntegrationStatusType;
  /** 사용자에게 표시할 상태 텍스트 */
  statusText: string;
  /** 상세 설명 (tooltip 등) */
  description: string;
}

// ============================================
// SSOT: 세션 상태 판단 함수
// ============================================

/**
 * 세션 상태가 "정상 실행 가능"인지 판단 (SSOT)
 * 
 * 이 함수는 프로젝트 전역에서 세션이 글쓰기/스케줄 실행 등에
 * 사용 가능한 상태인지 판단하는 **유일한 기준**입니다.
 * 
 * @param sessionStatus - NaverSession.status 값
 * @returns 정상 실행 가능 여부
 * 
 * @example
 * // 프론트엔드에서
 * const sessions = await naverSessionApi.list();
 * const isHealthy = isSessionHealthy(sessions[0]?.status);
 * 
 * @example
 * // 백엔드에서
 * const session = await prisma.naverSession.findFirst({ ... });
 * if (!isSessionHealthy(session?.status)) {
 *   throw new Error('세션 연동이 필요합니다');
 * }
 */
export function isSessionHealthy(sessionStatus?: string | null): boolean {
  if (!sessionStatus) return false;
  
  // HEALTHY 또는 EXPIRING(만료 임박이지만 아직 사용 가능)일 때만 정상
  return (
    sessionStatus === SESSION_STATUS.HEALTHY ||
    sessionStatus === SESSION_STATUS.EXPIRING
  );
}

/**
 * 연동 상태 타입(Integration Status)이 "정상 실행 가능"인지 판단 (SSOT)
 * 
 * 대시보드 API의 getIntegrationStatus()에서 반환하는 status 값 기준입니다.
 * 
 * @param integrationStatus - IntegrationStatusResponse.status 값
 * @returns 정상 실행 가능 여부
 * 
 * @example
 * const integrationStatus = await dashboardApi.getIntegrationStatus();
 * const isHealthy = isIntegrationOK(integrationStatus.status);
 */
export function isIntegrationOK(integrationStatus?: string | null): boolean {
  if (!integrationStatus) return false;
  
  // OK 또는 WARNING(주의지만 아직 실행 가능)일 때 정상
  return integrationStatus === 'OK' || integrationStatus === 'WARNING';
}

/**
 * 세션 상태에 대한 상세 판단 결과 반환 (SSOT)
 * 
 * UI에서 상태 배지, 설명 텍스트 등을 표시할 때 사용합니다.
 * 
 * @param sessionStatus - NaverSession.status 값
 * @param lastVerifiedAt - 마지막 검증 시간 (optional)
 * @returns SessionHealthResult
 * 
 * @example
 * const result = getSessionHealthDetails(session.status, session.lastVerifiedAt);
 * <Chip label={result.statusText} color={result.isHealthy ? 'success' : 'error'} />
 */
export function getSessionHealthDetails(
  sessionStatus?: string | null,
  lastVerifiedAt?: Date | string | null
): SessionHealthResult {
  if (!sessionStatus) {
    return {
      isHealthy: false,
      integrationType: 'NOT_CONNECTED',
      statusText: '연동 필요',
      description: '네이버 계정이 연동되지 않았습니다',
    };
  }

  const now = new Date();
  const lastVerified = lastVerifiedAt ? new Date(lastVerifiedAt) : null;
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  switch (sessionStatus) {
    case SESSION_STATUS.HEALTHY:
      // 24시간 이내 검증되었으면 완전 정상
      if (lastVerified && lastVerified > twentyFourHoursAgo) {
        return {
          isHealthy: true,
          integrationType: 'OK',
          statusText: '정상 연결',
          description: '네이버 계정이 정상적으로 연동되어 있습니다',
        };
      }
      // 24시간 초과면 주의 (하지만 아직 사용 가능)
      return {
        isHealthy: true,
        integrationType: 'WARNING',
        statusText: '확인 필요',
        description: '세션 상태 확인이 필요합니다. 자동 검증이 진행됩니다',
      };

    case SESSION_STATUS.EXPIRING:
      return {
        isHealthy: true,
        integrationType: 'WARNING',
        statusText: '만료 임박',
        description: '세션이 곧 만료됩니다. 재연동을 권장합니다',
      };

    case SESSION_STATUS.PENDING:
      return {
        isHealthy: false,
        integrationType: 'WARNING',
        statusText: '연동 중',
        description: '네이버 세션 연동이 진행 중입니다',
      };

    case SESSION_STATUS.EXPIRED:
      return {
        isHealthy: false,
        integrationType: 'ACTION_REQUIRED',
        statusText: '만료됨',
        description: '세션이 만료되었습니다. 재연동이 필요합니다',
      };

    case SESSION_STATUS.CHALLENGE_REQUIRED:
      return {
        isHealthy: false,
        integrationType: 'ACTION_REQUIRED',
        statusText: '인증 필요',
        description: '네이버 추가 인증이 필요합니다. 연동 페이지를 확인해주세요',
      };

    case SESSION_STATUS.ERROR:
      return {
        isHealthy: false,
        integrationType: 'ACTION_REQUIRED',
        statusText: '오류 발생',
        description: '세션에 오류가 발생했습니다. 재연동이 필요합니다',
      };

    default:
      return {
        isHealthy: false,
        integrationType: 'ACTION_REQUIRED',
        statusText: '알 수 없음',
        description: '알 수 없는 세션 상태입니다',
      };
  }
}

/**
 * 연동 상태 타입에 대한 상세 판단 결과 반환 (SSOT)
 * 
 * 대시보드 API 응답의 status 값을 기반으로 UI 표시 정보를 반환합니다.
 * 
 * @param integrationStatus - IntegrationStatusResponse.status 값
 * @param statusReason - 상태 사유 (optional)
 * @returns SessionHealthResult
 */
export function getIntegrationHealthDetails(
  integrationStatus?: string | null,
  statusReason?: string | null
): SessionHealthResult {
  const defaultDescription = statusReason || '';

  switch (integrationStatus) {
    case 'OK':
      return {
        isHealthy: true,
        integrationType: 'OK',
        statusText: '정상 연결',
        description: defaultDescription || '네이버 계정이 정상적으로 연동되어 있습니다',
      };

    case 'WARNING':
      return {
        isHealthy: true,
        integrationType: 'WARNING',
        statusText: '주의',
        description: defaultDescription || '세션 상태를 확인해주세요',
      };

    case 'ACTION_REQUIRED':
      return {
        isHealthy: false,
        integrationType: 'ACTION_REQUIRED',
        statusText: '조치 필요',
        description: defaultDescription || '재연동이 필요합니다',
      };

    case 'NOT_CONNECTED':
      return {
        isHealthy: false,
        integrationType: 'NOT_CONNECTED',
        statusText: '연동 필요',
        description: defaultDescription || '네이버 계정을 연동해주세요',
      };

    default:
      return {
        isHealthy: false,
        integrationType: 'NOT_CONNECTED',
        statusText: '연동 필요',
        description: defaultDescription || '네이버 계정을 연동해주세요',
      };
  }
}



