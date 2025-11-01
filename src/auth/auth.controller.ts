import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthCron } from './auth.cron';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly AuthCron: AuthCron,
    private readonly authService: AuthService,
  ) {}

  @Post('add')
  async addAccount(@Body('phone') phone: string) {
    return this.auth.addAccount(phone);
  }

  @Get('list')
  listAccounts() {
    return this.auth.listAccounts();
  }

  @Delete(':id')
  async removeAccount(@Param('id') id: string) {
    return this.auth.removeAccount(id);
  }

  @Post('refresh-all')
  async refreshAll() {
    await this.AuthCron.refreshAll();
    return { status: 'ok', message: 'Tokens refreshed manually' };
  }

  
  @Post('reauth-all')
  async reauthAll() {
    await this.authService.forceReauthAll();
    return { status: 'ok' };
  }
}
