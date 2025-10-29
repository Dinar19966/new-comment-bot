import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { RedisLockService } from './redis-lock.service';

@Injectable()
export class AuthCron {
  private readonly logger = new Logger(AuthCron.name);

  constructor(
    private readonly auth: AuthService,
    private readonly lock: RedisLockService,
  ) {}

  // Проверяет все аккаунты раз в час
  @Cron(CronExpression.EVERY_HOUR)
  async refreshAll() {
    this.logger.log('⏰ Запуск проверки токенов...');
    const accounts = await this.auth.listAccounts();

    for (const acc of accounts) {
      const lockKey = `refresh:${acc.phone}`;

      // предотвращаем параллельные обновления одного аккаунта
      const locked = await this.lock.acquireLock(lockKey, 60_000);
      if (!locked) continue;

      try {
        await this.auth.getAccessToken(acc.id);
      } catch (e) {
        this.logger.warn(`⚠️ Не удалось обновить токен для ${acc.phone}: ${e.message}`);
      } finally {
        await this.lock.releaseLock(lockKey);
      }
    }

    this.logger.log('✅ Проверка токенов завершена');
  }
}
