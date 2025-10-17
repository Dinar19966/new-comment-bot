import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisLockService } from './redis-lock.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [AuthService, PrismaService, RedisLockService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
