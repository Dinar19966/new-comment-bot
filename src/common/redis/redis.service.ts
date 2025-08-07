// src/common/redis.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error:', error);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Failed to get key ${key}`, error.stack);
      throw error;
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    try {
      if (ttlSeconds) {
        return await this.redis.set(key, value, 'EX', ttlSeconds);
      }
      return await this.redis.set(key, value);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}`, error.stack);
      throw error;
    }
  }

  async delete(key: string): Promise<number> {
    try {
      return await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}`, error.stack);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check existence for key ${key}`,
        error.stack,
      );
      throw error;
    }
  }

  async isAlreadyCommented(postId: string): Promise<boolean> {
    return this.exists(`commented:${postId}`);
  }

  async markAsCommented(postId: string): Promise<void> {
    await this.set(
      `commented:${postId}`,
      '1',
      7 * 24 * 60 * 60, // 7 дней в секундах
    );
  }

  async getCommentCache(postContentHash: string): Promise<string | null> {
    return this.get(`comment:${postContentHash}`);
  }

  async setCommentCache(
    postContentHash: string,
    comment: string,
    ttlHours = 24,
  ): Promise<void> {
    await this.set(`comment:${postContentHash}`, comment, ttlHours * 60 * 60);
  }

  async incrementCounter(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment counter ${key}`, error.stack);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Failed to set TTL for key ${key}`, error.stack);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      this.logger.error('Failed to disconnect from Redis', error.stack);
    }
  }
}
