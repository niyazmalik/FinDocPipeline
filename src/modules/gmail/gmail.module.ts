import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthModule } from '../auth/auth.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [AuthModule, GeminiModule],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
