import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';

@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private redis: IORedis.Redis;

  constructor() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redis = new IORedis(url);
  }

  async onModuleInit() { /* noop */ }
  async onModuleDestroy() { await this.redis.quit(); }

  // try to acquire lock, return true if acquired
  async acquireLock(key: string, ttl = 10000): Promise<boolean> {
    const token = Date.now().toString();
    const result = await this.redis.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
