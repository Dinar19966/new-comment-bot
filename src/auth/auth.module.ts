import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RedisLockService } from './redis-lock.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthCron } from './auth.cron';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [AuthService, PrismaService, RedisLockService, AuthCron],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
