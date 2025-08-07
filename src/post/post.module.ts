import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostService } from './post.service';
import { RedisService } from 'src/common/redis/redis.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        timeout: configService.get<number>('HTTP_TIMEOUT', 5000),
        maxRedirects: configService.get<number>('HTTP_MAX_REDIRECTS', 3),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  providers: [PostService, RedisService],
  exports: [PostService],
})
export class PostModule {}
