import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  appealItemInputSchema,
  reportItemInputSchema,
} from '../../routes/reporting/ReportingRoutes.js';
import submitAppeal from '../../routes/reporting/submitAppeal.js';
import submitReport from '../../routes/reporting/submitReport.js';
import { InjectDeps } from '../tokens.js';
import { runExpressHandler } from './expressHandler.js';
import { ApiKeyGuard, BodySchemaGuard } from './guards.js';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * POST /report and /report/appeal. Routing, body validation and API-key auth
 * are Nest guards; the handler bodies are the existing Express handlers.
 */
@Controller('report')
export class ReportingController {
  private readonly submitReport: Handler;
  private readonly submitAppeal: Handler;

  constructor(@InjectDeps() deps: Dependencies) {
    this.submitReport = submitReport(deps) as Handler;
    this.submitAppeal = submitAppeal(deps) as Handler;
  }

  @Post()
  @UseGuards(BodySchemaGuard(reportItemInputSchema), ApiKeyGuard)
  async report(@Req() req: Request, @Res() res: Response) {
    await runExpressHandler(this.submitReport, req, res);
  }

  @Post('appeal')
  @UseGuards(BodySchemaGuard(appealItemInputSchema), ApiKeyGuard)
  async appeal(@Req() req: Request, @Res() res: Response) {
    await runExpressHandler(this.submitAppeal, req, res);
  }
}
