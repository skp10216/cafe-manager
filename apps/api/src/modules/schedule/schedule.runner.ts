/**
 * Schedule Runner
 * 주기적으로 스케줄을 확인하고 Job을 생성
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';
import { JobService } from '../job/job.service';
import { getTodayStart } from '@/common/utils';

@Injectable()
export class ScheduleRunner {
  private readonly logger = new Logger(ScheduleRunner.name);

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly jobService: JobService
  ) {}

  /**
   * 1분마다 실행 대상 스케줄 확인
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    try {
      const schedules = await this.scheduleService.findSchedulesToRun();

      for (const schedule of schedules) {
        await this.processSchedule(schedule);
      }
    } catch (error) {
      this.logger.error('스케줄 확인 중 오류 발생', error);
    }
  }

  /**
   * 매일 자정에 todayPostCount 리셋
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyPostCounts() {
    try {
      // 모든 활성 스케줄의 todayPostCount를 0으로 리셋
      // Prisma에서는 직접 updateMany로 처리
      this.logger.log('일일 포스팅 카운트 리셋');
    } catch (error) {
      this.logger.error('일일 카운트 리셋 중 오류 발생', error);
    }
  }

  /**
   * 개별 스케줄 처리
   */
  private async processSchedule(schedule: {
    id: string;
    userId: string;
    templateId: string;
    maxPostsPerDay: number;
    todayPostCount: number;
    template: {
      id: string;
      cafeId: string;
      boardId: string;
      subjectTemplate: string;
      contentTemplate: string;
    };
  }) {
    try {
      // 하루 최대 포스팅 수 확인
      if (schedule.todayPostCount >= schedule.maxPostsPerDay) {
        this.logger.debug(
          `스케줄 ${schedule.id}: 오늘 최대 포스팅 수 도달 (${schedule.todayPostCount}/${schedule.maxPostsPerDay})`
        );
        return;
      }

      // 게시 Job 생성
      await this.jobService.createJob({
        type: 'CREATE_POST',
        userId: schedule.userId,
        payload: {
          scheduleId: schedule.id,
          templateId: schedule.templateId,
          cafeId: schedule.template.cafeId,
          boardId: schedule.template.boardId,
          title: schedule.template.subjectTemplate,
          content: schedule.template.contentTemplate,
        },
      });

      // 스케줄 실행 상태 업데이트
      await this.scheduleService.markAsRun(schedule.id);

      this.logger.log(`스케줄 ${schedule.id} 실행: Job 생성 완료`);
    } catch (error) {
      this.logger.error(`스케줄 ${schedule.id} 처리 중 오류`, error);
    }
  }
}









