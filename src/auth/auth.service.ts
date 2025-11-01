import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly baseUrl: string;
  private readonly accessTtlMs = 3 * 60 * 60 * 1000; // 3 часа

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = 'https://finbazar.ru';
  }

  private async requestOtp(phone: string) {
    const url = `${this.baseUrl}/api/gate/auth/request-otp`;
    await firstValueFrom(this.http.post(url, { phone, purpose: 'sign_in' }));
  }

  private async signIn(phone: string, code = '1489') {
    const url = `${this.baseUrl}/api/gate/auth/sign-in`;
    const resp = await firstValueFrom(this.http.post(url, { phone, code }));
    return resp.data as { token: string; refreshToken: string };
  }

  private async refreshToken(refreshToken: string) {
    const url = `${this.baseUrl}/api/gate/auth/token`;
    const body = { refreshToken, grantType: 'refresh_token' };
    const resp = await firstValueFrom(this.http.post(url, body));
    return resp.data as { token: string; refreshToken: string };
  }

  /** Добавляет аккаунт в БД (или обновляет, если уже есть) */
  async addAccount(phone: string) {
    await this.requestOtp(phone);
    const { token, refreshToken } = await this.signIn(phone, '1111');

    const acc = await this.prisma.account.upsert({
      where: { phone },
      update: {
        accessToken: token,
        refreshToken,
        accessExpiresAt: new Date(Date.now() + this.accessTtlMs),
        status: 'active',
      },
      create: {
        phone,
        accessToken: token,
        refreshToken,
        accessExpiresAt: new Date(Date.now() + this.accessTtlMs),
      },
    });

    this.logger.log(`✅ Аккаунт добавлен: ${phone}`);
    return acc;
  }

  /** Возвращает список аккаунтов */
  async listAccounts() {
    return this.prisma.account.findMany({
      select: {
        id: true,
        phone: true,
        accessExpiresAt: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Удаляет аккаунт */
  async removeAccount(id: string) {
    await this.prisma.account.delete({ where: { id } });
    this.logger.log(`🗑 Аккаунт удалён: ${id}`);
  }

  /** Возвращает валидный токен (при необходимости обновляет) */
  async getAccessToken(accountId: string): Promise<string> {
    const acc = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!acc) throw new Error('Account not found');

    // если токен ещё действителен
    if (
      acc.accessToken &&
      acc.accessExpiresAt &&
      acc.accessExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return acc.accessToken;
    }

    // иначе — обновляем по refreshToken
    if (!acc.refreshToken) {
      this.logger.warn(`⚠️ Нет refreshToken для ${acc.phone}`);
      throw new Error('Missing refreshToken');
    }

    try {
      const { token, refreshToken: newRefresh } = await this.refreshToken(acc.refreshToken);
      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: {
          accessToken: token,
          refreshToken: newRefresh,
          accessExpiresAt: new Date(Date.now() + this.accessTtlMs),
          status: 'active',
        },
      });

      this.logger.log(`♻️ Токен обновлён: ${acc.phone}`);
      return updated.accessToken!;
    } catch (e) {
      this.logger.error(`❌ Ошибка при обновлении токена для ${acc.phone}: ${e.message}`);
      await this.prisma.account.update({
        where: { id: accountId },
        data: { status: 'need_reauth' },
      });
      throw new Error('Refresh failed, need re-auth');
    }
  }

/** Переавторизирует все аккаунты, у которых status = 'need_reauth' */
async forceReauthAll() {
  this.logger.log('🔄 Запуск массовой переавторизации аккаунтов...');

  const accounts = await this.prisma.account.findMany({
    where: { status: 'need_reauth' },
  });

  if (!accounts.length) {
    this.logger.log('✅ Нет аккаунтов, требующих повторной авторизации');
    return;
  }

  for (const acc of accounts) {
    this.logger.log(`📲 Переавторизация: ${acc.phone}`);

    try {
      await this.requestOtp(acc.phone);

      let tokenResp;
      const maxRetries = 5;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // пробуем войти с фиксированным OTP
          tokenResp = await this.signIn(acc.phone, '1489');
          break; // вышли если удалось
        } catch (e) {
          // если 400 — ждём и пробуем снова
          if (e.response?.status === 400) {
            this.logger.warn(`⏳ OTP ещё не готов для ${acc.phone}, попытка ${attempt}`);
            await new Promise(res => setTimeout(res, 6000)); // ждём 1 сек
          } else {
            throw e; // другие ошибки пробрасываем
          }
        }
      }

      if (!tokenResp) throw new Error('Не удалось войти после нескольких попыток');

      // обновляем в БД
      await this.prisma.account.update({
        where: { id: acc.id },
        data: {
          accessToken: tokenResp.token,
          refreshToken: tokenResp.refreshToken,
          accessExpiresAt: new Date(Date.now() + this.accessTtlMs),
          status: 'active',
        },
      });

      this.logger.log(`✅ ${acc.phone} успешно переавторизован`);
    } catch (e) {
      this.logger.error(`❌ Ошибка при реавторизации ${acc.phone}: ${e.message}`);
    }

    // задержка перед следующим аккаунтом
    await new Promise(res => setTimeout(res, 500)); // 0.5 сек
  }

  this.logger.log('🏁 Массовая переавторизация завершена');
}

}
