/**
 * Worker 오류 메시지를 사용자 친화적 안내문으로 변환하는 헬퍼
 * 워커의 errorMessage를 그대로 노출하지 않고, 원인별 요약/가이드를 제공합니다.
 */

export type WorkerErrorCause =
  | 'CREDENTIAL'
  | 'OTP_REQUIRED'
  | 'CHALLENGE'
  | 'LIMITED'
  | 'SESSION_EXPIRED'
  | 'NETWORK'
  | 'SECURITY'
  | 'UNKNOWN';

export interface WorkerErrorGuide {
  cause: WorkerErrorCause;
  headline: string;
  description: string;
  hints: string[];
  actionPrimary?: string;
  actionSecondary?: string;
  severity: 'info' | 'warning' | 'error';
  errorCode?: string | null;
  raw?: string | null;
}

function includesAny(target: string, keywords: string[]): boolean {
  const lowered = target.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function detectErrorCause(errorMessage?: string | null, errorCode?: string | null): WorkerErrorCause {
  const normalizedMessage = (errorMessage || '').toLowerCase();
  const normalizedCode = (errorCode || '').toUpperCase();

  if (
    includesAny(normalizedMessage, ['otp', '2fa', '2단계', '보안코드', 'authenticator']) ||
    normalizedCode === 'CHALLENGE_REQUIRED'
  ) {
    return 'OTP_REQUIRED';
  }

  if (
    includesAny(normalizedMessage, ['captcha', '보안문자', '추가 인증', 'challenge']) ||
    normalizedCode === 'CHALLENGE_REQUIRED'
  ) {
    return 'CHALLENGE';
  }

  if (
    includesAny(normalizedMessage, ['password', '비밀번호', 'credential', 'login failed', '아이디']) ||
    normalizedCode === 'LOGIN_FAILED' ||
    normalizedCode === 'AUTH_INVALID'
  ) {
    return 'CREDENTIAL';
  }

  if (
    includesAny(normalizedMessage, ['rate', '제한', 'too many', 'blocked', 'block', '제한되었습니다']) ||
    normalizedCode === 'RATE_LIMIT'
  ) {
    return 'LIMITED';
  }

  if (
    includesAny(normalizedMessage, ['만료', 'expired', '로그아웃', 'session expired']) ||
    normalizedCode === 'AUTH_EXPIRED'
  ) {
    return 'SESSION_EXPIRED';
  }

  if (
    includesAny(normalizedMessage, ['network', 'timeout', '연결', '시간 초과']) ||
    normalizedCode === 'NETWORK_ERROR' ||
    normalizedCode === 'TIMEOUT'
  ) {
    return 'NETWORK';
  }

  if (includesAny(normalizedMessage, ['policy', '보안', '제재', '차단', 'naver'])) {
    return 'SECURITY';
  }

  return 'UNKNOWN';
}

/**
 * 워커 오류 메시지를 가이드 형태로 변환합니다.
 */
export function mapWorkerErrorToGuide(params: {
  errorMessage?: string | null;
  errorCode?: string | null;
  context?: 'INIT_SESSION' | 'VERIFY_SESSION' | 'CREATE_POST' | 'JOB';
}): WorkerErrorGuide | null {
  const { errorMessage, errorCode, context } = params;

  if (!errorMessage && !errorCode) {
    return null;
  }

  const cause = detectErrorCause(errorMessage, errorCode);

  const baseGuide: Record<WorkerErrorCause, Omit<WorkerErrorGuide, 'errorCode' | 'raw'>> = {
    CREDENTIAL: {
      cause,
      headline: '아이디/비밀번호를 다시 확인해주세요',
      description: '네이버 로그인 단계에서 인증에 실패했습니다. 최근에 비밀번호가 변경되었거나 일회성 코드가 필요한 경우일 수 있습니다.',
      hints: ['비밀번호를 다시 입력하거나 네이버에서 비밀번호 재설정을 진행해주세요.'],
      actionPrimary: '재시도',
      actionSecondary: '비밀번호 재설정',
      severity: 'error',
    },
    OTP_REQUIRED: {
      cause,
      headline: '추가 인증(OTP/2단계 인증)이 필요합니다',
      description: '네이버가 OTP 또는 보안코드를 요구하고 있습니다. 수동 인증이 완료될 때까지 연동이 지연될 수 있습니다.',
      hints: ['네이버 앱 또는 인증기에서 코드를 확인한 뒤 직접 인증을 완료해주세요.'],
      actionPrimary: '직접 인증',
      actionSecondary: '재시도',
      severity: 'warning',
    },
    CHALLENGE: {
      cause,
      headline: '추가 인증 또는 CAPTCHA가 필요합니다',
      description: '자동 로그인이 차단되어 보안 문구 입력이나 직접 로그인이 필요합니다.',
      hints: ['직접 로그인하여 보안 문구를 통과한 뒤 다시 연동을 진행해주세요.'],
      actionPrimary: '직접 인증',
      actionSecondary: '재시도',
      severity: 'warning',
    },
    LIMITED: {
      cause,
      headline: '네이버에서 로그인 시도를 제한하고 있습니다',
      description: '짧은 시간에 많은 요청이 발생했거나 네이버 보안 정책에 의해 차단되었습니다.',
      hints: ['잠시 대기한 후 다시 시도하거나, 수동 로그인으로 정상 진입 후 재연동을 요청해주세요.'],
      actionPrimary: '재시도',
      actionSecondary: '직접 인증',
      severity: 'warning',
    },
    SESSION_EXPIRED: {
      cause,
      headline: '세션이 만료되었어요',
      description: '보관된 쿠키가 만료되었거나 로그아웃되었습니다. 다시 로그인하여 새 세션을 발급해야 합니다.',
      hints: ['재검증 또는 재연결을 눌러 새 세션을 생성해주세요.'],
      actionPrimary: '재검증',
      actionSecondary: '재연결',
      severity: 'warning',
    },
    NETWORK: {
      cause,
      headline: '네트워크/시간초과로 연동이 지연되었습니다',
      description: '네이버 페이지 응답이 느리거나 일시적인 연결 문제가 있었습니다.',
      hints: ['네트워크 상태를 확인하고 잠시 후 다시 시도해주세요.'],
      actionPrimary: '재시도',
      actionSecondary: '직접 인증',
      severity: 'warning',
    },
    SECURITY: {
      cause,
      headline: '네이버 보안 정책에 막혀 있습니다',
      description: '비정상 로그인으로 판단되어 추가 인증이나 잠금 해제가 필요합니다.',
      hints: ['네이버 보안 설정(로그인 차단, 해외 IP 차단 등)을 확인하고 해제 후 다시 인증해주세요.'],
      actionPrimary: '직접 인증',
      actionSecondary: '재시도',
      severity: 'warning',
    },
    UNKNOWN: {
      cause,
      headline: '연동 과정에서 오류가 발생했습니다',
      description: '정확한 원인을 파악하지 못했습니다. 추가 로그 확인이 필요할 수 있습니다.',
      hints: ['다시 시도하거나 지원팀에 문의해주세요.'],
      actionPrimary: '재시도',
      actionSecondary: '지원 요청',
      severity: 'error',
    },
  };

  const guide = baseGuide[cause];

  const contextHint: Record<NonNullable<typeof context>, string> = {
    INIT_SESSION: '초기 세션 발급 단계에서 문제가 발생했습니다. 자동 로그인 대신 직접 인증을 진행하면 빠르게 해결할 수 있습니다.',
    VERIFY_SESSION: '세션 검증 중 문제가 감지되었습니다. 재검증 또는 재연결을 통해 새 세션을 받아주세요.',
    CREATE_POST: '게시글 작성 단계에서 문제가 발생했습니다. 입력 데이터와 계정 권한을 확인해주세요.',
    JOB: '작업 실행 중 오류가 발생했습니다. 로그를 검토한 뒤 재시도하세요.',
  };

  return {
    ...guide,
    description: context && contextHint[context] ? `${guide.description} ${contextHint[context]}` : guide.description,
    errorCode,
    raw: errorMessage,
  };
}

/**
 * 오류 가이드의 핵심 문구만 필요할 때 사용합니다.
 */
export function getWorkerErrorSummary(errorMessage?: string | null, errorCode?: string | null): string | null {
  const guide = mapWorkerErrorToGuide({ errorMessage, errorCode });
  return guide?.headline || guide?.description || null;
}

