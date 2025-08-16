import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ScanService } from './scan.service';
import { AuthService } from '../auth/auth.service';

@Controller('scan')
export class ScanController {
    constructor(
        private readonly scanService: ScanService,
        private readonly authService: AuthService) { }

    @Get()
    async scanInbox(@Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('userId query parameter is required');

        // Process inbox using stored tokens in DB
        const gmailData = await this.scanService.processInbox(userId);

        return gmailData;
    }
}
