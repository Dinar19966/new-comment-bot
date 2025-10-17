import { IsPhoneNumber } from 'class-validator';

export class AddAccountDto {
  phone: string; // simple validation left to controller
}
