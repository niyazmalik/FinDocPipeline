import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ScanService } from './scan.service';

@Controller('scan')
export class ScanController {
    constructor(
        private readonly scanService: ScanService) { }

    @Get()
    async scanInbox(@Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('userId query parameter is required');

        const gmailData = await this.scanService.processInbox(userId);

        return {
            message: "Emails fetched, processed, got uploaded and recorded in database...",
            gmailData,
        };
    }
}
