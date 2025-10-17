import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
}
