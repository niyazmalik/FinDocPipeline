import { Controller, Get, InternalServerErrorException, Query, Res } from '@nestjs/common';
import { ScanService } from './scan.service';

@Controller('scan')
export class ScanController {
    constructor(
        private readonly scanService: ScanService) { }
    @Get()
    async scan(@Query('userId') userId: string) {
        try {
            const Mail_IDs = await this.scanService.processInbox(userId);
            return {
                message: 'Processed mails...',
                Mail_IDs,
            };
        } catch (err) {
            console.error('Error in scan:', err);
            throw new InternalServerErrorException('Internal server error');
        }
    }

}
