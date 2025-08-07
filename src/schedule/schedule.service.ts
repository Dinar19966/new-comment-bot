import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { CommentService } from '../comment/comment.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly minComments: number;
  private readonly maxComments: number;
  private readonly workHours: { start: number; end: number };

  constructor(
    private readonly commentService: CommentService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.minComments = this.configService.get<number>(
      'MIN_COMMENTS_PER_DAY',
      20,
    );
    this.maxComments = this.configService.get<number>(
      'MAX_COMMENTS_PER_DAY',
      30,
    );
    this.workHours = {
      start: this.configService.get<number>('WORK_HOURS_START', 9),
      end: this.configService.get<number>('WORK_HOURS_END', 19),
    };
  }

  @Cron('0 9 * * *', { timeZone: 'Europe/Moscow' }) // Каждый день в 09:00 МСК
  async initDailySchedule() {
    const count = this.getRandomInt(this.minComments, this.maxComments);
    this.logger.log(`Scheduling ${count} comments for today`);

    for (let i = 0; i < count; i++) {
      this.scheduleSingleTask(i);
    }
  }

  private scheduleSingleTask(index: number) {
    const delayMs = this.calculateRandomDelay();
    const timeout = setTimeout(() => this.executeCommentTask(index), delayMs);

    this.schedulerRegistry.addTimeout(`comment_task_${index}`, timeout);
  }

  private async executeCommentTask(index: number) {
    this.logger.log(`Executing comment task #${index}`);
    try {
      await this.commentService.generateAndSendComment();
    } catch (error) {
      this.logger.error(`Task #${index} failed: ${error.message}`);
    }
  }

  private calculateRandomDelay(): number {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      this.workHours.start,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      this.workHours.end,
      0,
      0,
    );

    const minTime = Math.max(todayStart.getTime(), now.getTime());
    const maxTime = todayEnd.getTime();

    return this.getRandomInt(minTime - now.getTime(), maxTime - now.getTime());
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
