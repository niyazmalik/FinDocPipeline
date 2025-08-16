import { Controller, Get, Query } from '@nestjs/common';
import { GmailService } from './gmail.service';

@Controller()
export class GmailController {
    constructor(private readonly gmailService: GmailService) { }

    @Get('scan')
    async scan(@Query('userId') userId: string) {
        if (!userId) {
            return { status: 400, message: 'userId query param required' };
        }

        const results = await this.gmailService.scanInbox(userId);

        // For now returning the results only...
        return results;
    }
}
