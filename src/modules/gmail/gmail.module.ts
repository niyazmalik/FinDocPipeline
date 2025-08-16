import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthModule } from '../auth/auth.module';;

@Module({
  imports: [AuthModule],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
