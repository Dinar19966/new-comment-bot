import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { GeneratorModule } from '../generator/generator.module';
import { PostModule } from '../post/post.module';
import { RedisService } from 'src/common/redis/redis.service';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 3,
      }),
    }),
    GeneratorModule,
    PostModule,
    AuthModule,
  ],
  providers: [CommentService, RedisService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule {}
