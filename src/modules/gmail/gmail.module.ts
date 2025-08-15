import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthModule } from '../auth/auth.module';
import { GmailController } from './gmail.controller';

@Module({
  imports: [AuthModule],
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
