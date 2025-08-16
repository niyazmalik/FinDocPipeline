import { Module } from '@nestjs/common';
import { SheetService } from './sheet.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    providers: [SheetService],
    exports: [SheetService],
})
export class SheetModule { }
