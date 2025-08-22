import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { AuthModule } from 'src/modules/auth/auth.module';
import { GmailModule } from 'src/modules/gmail/gmail.module';
import { DriveModule } from 'src/modules/drive/drive.module';
import { ScanService } from './scan.service';
import { SheetModule } from 'src/modules/sheet/sheet.module';
import { User } from 'src/entities/user.entity';
import { Email } from 'src/entities/email.entity';
import { ProcessedEmail } from 'src/entities/processed-email.entity';
import { GoogleDriveFile } from 'src/entities/google-drive-file.entity';
import { GoogleSheetsRecord } from 'src/entities/google-sheets-record.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeminiModule } from 'src/modules/gemini/gemini.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Email, ProcessedEmail, GoogleDriveFile, GoogleSheetsRecord]), 
    AuthModule,
    GmailModule,
    DriveModule,
    SheetModule],
  providers: [ScanService],
  controllers: [ScanController],
})
export class ScanModule {}
