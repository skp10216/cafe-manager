/**
 * Schedule Runner
 * 주기적으로 스케줄을 확인하고 Job을 생성
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ScheduleService } from './schedule.service';
import { ScheduleRunService } from '../schedule-run/schedule-run.service';
import { JobService } from '../job/job.service';

@Injectable()
export class ScheduleRunner {
  private readonly logger = new Logger(ScheduleRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly scheduleRunService: ScheduleRunService,
    private readonly jobService: JobService
  ) {}

  /**
   * 1분마다 실행 대상 스케줄 확인
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);  // "09:05"
      const currentDate = now.toISOString().slice(0, 10);  // "2025-12-24"

      // 1. 실행 대상 스케줄 찾기
      const schedules = await this.scheduleService.findSchedulesToRun(currentTime, currentDate);

      for (const schedule of schedules) {
        // 2. ScheduleRun 생성 (중복 방지)
        const run = await this.scheduleRunService.createOrSkip({
          scheduleId: schedule.id,
          userId: schedule.userId,
          runDate: new Date(currentDate),
        });

        if (!run) {
          this.logger.debug(`스케줄 ${schedule.id}: 오늘 이미 실행됨`);
          continue;
        }

        // 3. N개 Job 생성 (간격 적용)
        await this.createJobsForRun(schedule, run);
      }
    } catch (error) {
      this.logger.error('스케줄 확인 중 오류 발생', error);
    }
  }

  /**
   * 스케줄에 대해 N개 Job 생성 (간격 적용)
   */
  async createJobsForRun(schedule: any, run: any) {
    const jobs = [];

    for (let i = 0; i < schedule.dailyPostCount; i++) {
      const delayMinutes = i * schedule.postIntervalMinutes;

      // 시스템 변수 생성
      const systemVariables = this.getSystemVariables();

      // 템플릿 변수 치환
      const title = this.replaceVariables(schedule.template.subjectTemplate, systemVariables);
      const content = this.replaceVariables(schedule.template.contentTemplate, systemVariables);

      // 이미지 경로 목록
      const imagePaths = schedule.template.images
        .sort((a, b) => a.order - b.order)
        .map((img) => img.path);

      // Job 생성 (BullMQ delay 사용)
      const job = await this.jobService.createJob({
        type: 'CREATE_POST',
        userId: schedule.userId,
        scheduleRunId: run.id,
        sequenceNumber: i + 1,
        delay: delayMinutes * 60 * 1000,  // ms 단위
        payload: {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          templateId: schedule.template.id,
          templateName: schedule.template.name,
          cafeId: schedule.template.cafeId,
          cafeName: schedule.template.cafeName,
          boardId: schedule.template.boardId,
          boardName: schedule.template.boardName,
          title,
          content,
          imagePaths,
          price: schedule.template.price,
          tradeMethod: schedule.template.tradeMethod,
          tradeLocation: schedule.template.tradeLocation,
        },
      });

      jobs.push(job);
    }

    // ScheduleRun 통계 업데이트
    await this.scheduleRunService.update(run.id, {
      totalJobs: jobs.length,
      status: 'RUNNING',
    });

    // Schedule lastRunDate 업데이트
    await this.scheduleService.markAsRun(schedule.id);

    this.logger.log(
      `스케줄 ${schedule.id} 실행: ${jobs.length}개 Job 생성 완료 ` +
      `(간격: ${schedule.postIntervalMinutes}분)`
    );
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









