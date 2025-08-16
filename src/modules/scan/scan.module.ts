import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { AuthModule } from '../auth/auth.module';
import { GmailModule } from '../gmail/gmail.module';
import { DriveModule } from '../drive/drive.module';
import { ScanService } from './scan.service';
import { SheetModule } from '../sheet/sheet.module';

@Module({
  imports: [AuthModule, GmailModule, DriveModule, SheetModule],
  providers: [ScanService],
  controllers: [ScanController],
})
export class ScanModule {}
