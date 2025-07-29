import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CommentModule } from './comment/comment.module';
import { GeneratorModule } from './generator/generator.module';
import { PostModule } from './post/post.module';
import { ScheduleTaskModule } from './schedule/schedule.module';
import { RedisModule } from './common/redis/redis.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 3,
      }),
    }),
    CommentModule,
    GeneratorModule,
    PostModule,
    ScheduleTaskModule,
    RedisModule
  ],
})
export class AppModule {}