/**
 * 시간 포맷 유틸리티
 * 대시보드 UX 향상을 위한 시간 표시 함수들
 */

/**
 * 절대시간 + 상대시간 포맷
 * 예: "오후 05:53:17 · 2분 전"
 * 
 * @param dateStr - ISO 8601 형식의 날짜 문자열
 * @returns 포맷된 시간 문자열
 */
export function formatTimeWithRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const now = new Date();
  
  // 절대 시간 (오후 05:53:17)
  const hours = date.getHours();
  const ampm = hours < 12 ? '오전' : '오후';
  const h12 = hours % 12 || 12;
  const time = `${ampm} ${String(h12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  
  // 상대 시간
  const relative = formatRelativeTime(date, now);
  
  return `${time} · ${relative}`;
}

/**
 * 상대 시간만 반환
 * 예: "방금", "3초 전", "5분 전", "2시간 전"
 * 
 * @param date - Date 객체
 * @param now - 현재 시간 (기본값: new Date())
 * @returns 상대 시간 문자열
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 5) {
    return '방금';
  } else if (diffSec < 60) {
    return `${diffSec}초 전`;
  } else if (diffMin < 60) {
    return `${diffMin}분 전`;
  } else if (diffHour < 24) {
    return `${diffHour}시간 전`;
  } else if (diffDay < 7) {
    return `${diffDay}일 전`;
  } else {
    // 1주일 이상이면 날짜로 표시
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * 전체 날짜/시간 포맷 (시계용)
 * 예: "2025.12.29 (월) 16:12:08"
 * 
 * @param date - Date 객체
 * @returns 포맷된 날짜/시간 문자열
 */
export function formatFullDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}.${month}.${day} (${weekday}) ${hours}:${minutes}:${seconds}`;
}

/**
 * 시간만 포맷 (HH:MM:SS)
 * 예: "16:12:08"
 * 
 * @param date - Date 객체
 * @returns 포맷된 시간 문자열
 */
export function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 날짜만 포맷 (YYYY.MM.DD 요일)
 * 예: "2025.12.29 월요일"
 * 
 * @param date - Date 객체
 * @returns 포맷된 날짜 문자열
 */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  return `${year}.${month}.${day} ${weekday}요일`;
}

/**
 * 남은 시간 포맷
 * 예: "3분 후", "1시간 24분 후"
 * 
 * @param targetDate - 목표 Date 객체
 * @param now - 현재 시간 (기본값: new Date())
 * @returns 남은 시간 문자열
 */
export function formatRemainingTime(targetDate: Date, now: Date = new Date()): string {
  const diffMs = targetDate.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return '지금';
  }
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffMin < 1) {
    return `${diffSec}초 후`;
  } else if (diffHour < 1) {
    return `${diffMin}분 후`;
  } else if (diffHour < 24) {
    const remainingMin = diffMin % 60;
    if (remainingMin > 0) {
      return `${diffHour}시간 ${remainingMin}분 후`;
    }
    return `${diffHour}시간 후`;
  } else {
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}일 후`;
  }
}



