import { Injectable, Logger } from '@nestjs/common'
import { Cron, SchedulerRegistry } from '@nestjs/schedule'
import { CommentService } from '../comment/comment.service'
import { SCHEDULE_CONFIG } from './schedule.config'

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)
  private readonly minComments: number
  private readonly maxComments: number
  private readonly workHours: { start: number; end: number }

  constructor(
    private readonly commentService: CommentService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.minComments = SCHEDULE_CONFIG.MIN_COMMENTS_PER_DAY
    this.maxComments = SCHEDULE_CONFIG.MAX_COMMENTS_PER_DAY
    this.workHours = {
      start: SCHEDULE_CONFIG.WORK_HOURS_START,
      end: SCHEDULE_CONFIG.WORK_HOURS_END,
    }
  }

  @Cron(SCHEDULE_CONFIG.DAILY_CRON, { timeZone: SCHEDULE_CONFIG.TIMEZONE })
  async initDailySchedule() {
    const count = this.getRandomInt(this.minComments, this.maxComments)
    this.logger.log(`Scheduling ${count} comments for today`)

    for (let i = 0; i < count; i++) {
      this.scheduleSingleTask(i)
    }
  }

  private scheduleSingleTask(index: number) {
    const delayMs = this.calculateRandomDelay()
    const timeout = setTimeout(() => this.executeCommentTask(index), delayMs)

    this.schedulerRegistry.addTimeout(`comment_task_${index}`, timeout)
  }

  private async executeCommentTask(index: number) {
    this.logger.log(`Executing comment task #${index}`)
    try {
      await this.commentService.generateAndSendComment()
    } catch (error) {
      this.logger.error(`Task #${index} failed: ${error.message}`)
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
    )
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      this.workHours.end,
      0,
      0,
    )

    const minTime = Math.max(todayStart.getTime(), now.getTime())
    const maxTime = todayEnd.getTime()

    return this.getRandomInt(minTime - now.getTime(), maxTime - now.getTime())
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
