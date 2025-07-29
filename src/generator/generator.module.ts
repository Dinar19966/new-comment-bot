import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeneratorService } from './generator.service';
import { RedisModule } from 'src/common/redis/redis.module';


@Module({
  imports: [ConfigModule, RedisModule], // Добавляем ConfigModule
  providers: [GeneratorService],
  exports: [GeneratorService],
})
export class GeneratorModule {}