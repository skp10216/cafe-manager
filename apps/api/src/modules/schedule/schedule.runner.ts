/**
 * Schedule Runner
 * 주기적으로 스케줄을 확인하고 Job을 생성
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ScheduleService } from './schedule.service';
import { JobService } from '../job/job.service';

@Injectable()
export class ScheduleRunner {
  private readonly logger = new Logger(ScheduleRunner.name);

  constructor(
    private readonly prisma: PrismaService,
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
      const result = await this.prisma.schedule.updateMany({
        where: { status: 'ACTIVE' },
        data: { todayPostCount: 0 },
      });
      this.logger.log(`일일 포스팅 카운트 리셋: ${result.count}개 스케줄`);
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
      price: number | null;
      tradeMethod: string | null;
      tradeLocation: string | null;
      variables: unknown;
      images: Array<{ id: string; path: string; order: number }>;
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

      // 시스템 변수 생성
      const systemVariables = this.getSystemVariables();

      // 템플릿 변수 치환
      const title = this.replaceVariables(
        schedule.template.subjectTemplate,
        systemVariables
      );
      const content = this.replaceVariables(
        schedule.template.contentTemplate,
        systemVariables
      );

      // 이미지 경로 목록 (순서대로)
      const imagePaths = schedule.template.images
        .sort((a, b) => a.order - b.order)
        .map((img) => img.path);

      // 게시 Job 생성
      await this.jobService.createJob({
        type: 'CREATE_POST',
        userId: schedule.userId,
        payload: {
          scheduleId: schedule.id,
          templateId: schedule.templateId,
          cafeId: schedule.template.cafeId,
          boardId: schedule.template.boardId,
          title,
          content,
          imagePaths,
          price: schedule.template.price,
          tradeMethod: schedule.template.tradeMethod,
          tradeLocation: schedule.template.tradeLocation,
        },
      });

      // 스케줄 실행 상태 업데이트
      await this.scheduleService.markAsRun(schedule.id);

      this.logger.log(
        `스케줄 ${schedule.id} 실행: Job 생성 완료 (이미지 ${imagePaths.length}개)`
      );
    } catch (error) {
      this.logger.error(`스케줄 ${schedule.id} 처리 중 오류`, error);
      
      // 오류 발생 시 스케줄 상태를 ERROR로 변경할 수 있음
      // await this.scheduleService.setError(schedule.id, error.message);
    }
  }

  /**
   * 시스템 변수 생성 (날짜, 시간 등)
   */
  private getSystemVariables(): Record<string, string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
      오늘날짜: `${year}-${month}-${day}`,
      오늘: `${year}년 ${month}월 ${day}일`,
      년도: String(year),
      월: month,
      일: day,
      시간: `${hours}:${minutes}`,
      시: hours,
      분: minutes,
      요일: ['일', '월', '화', '수', '목', '금', '토'][now.getDay()],
    };
  }

  /**
   * 템플릿 변수 치환
   */
  private replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables[trimmedKey] !== undefined
        ? variables[trimmedKey]
        : match;
    });
  }
}









