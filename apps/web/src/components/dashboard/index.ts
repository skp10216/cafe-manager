/**
 * 대시보드 컴포넌트 모음
 */

export { default as IntegrationStatusBanner } from './IntegrationStatusBanner';
export { default as JobSummaryCards } from './JobSummaryCards';
export { default as NextRunCards } from './NextRunCards';
export type { NextRunItem } from './NextRunCards';
export { default as TodayTimeline } from './TodayTimeline';
export type { TimelineItem } from './TodayTimeline';
export { default as RecentResultsList } from './RecentResultsList';
export type { RecentResultItem } from './RecentResultsList';
export { default as FailureSummary } from './FailureSummary';
export type { FailureCategoryItem } from './FailureSummary';
export { default as OnboardingChecklist } from './OnboardingChecklist';
export type { OnboardingStatus } from './OnboardingChecklist';

// 고도화 컴포넌트
export { default as StatusSummaryHeader } from './StatusSummaryHeader';
export { default as ActiveRunCard } from './ActiveRunCard';

// 복수 실행 지원 컴포넌트 (v2)
export { default as MultiRunTracker } from './MultiRunTracker';
export { default as GlobalRunOverview } from './GlobalRunOverview';
export { default as RunsList } from './RunsList';
export { default as RunDetail } from './RunDetail';


