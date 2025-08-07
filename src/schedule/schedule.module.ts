import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ScheduleService } from './schedule.service';
import { CommentModule } from '../comment/comment.module';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule, CommentModule],
  providers: [ScheduleService],
  exports: [ScheduleService], // Если нужно использовать в других модулях
})
export class ScheduleTaskModule {}
