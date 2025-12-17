/**
 * 공통 유틸리티 함수
 */

/**
 * 날짜를 한국 시간(KST) 문자열로 변환
 */
export function toKSTString(date: Date): string {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 오늘 자정(00:00:00) Date 객체 반환
 */
export function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * 오늘 끝(23:59:59) Date 객체 반환
 */
export function getTodayEnd(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

/**
 * 문자열을 안전하게 JSON 파싱
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * 밀리초를 사람이 읽기 쉬운 형태로 변환
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}초`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}분 ${Math.floor((ms % 60000) / 1000)}초`;
  return `${Math.floor(ms / 3600000)}시간 ${Math.floor((ms % 3600000) / 60000)}분`;
}

/**
 * 지정된 밀리초만큼 대기
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}









