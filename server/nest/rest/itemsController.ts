import { Body, Controller, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import { type Response } from 'express';

import { type Dependencies } from '../../iocContainer/index.js';
import {
  submitItemsInputSchema,
  type SubmitItemsInput,
} from '../../routes/items/ItemRoutes.js';
import { logErrorJson } from '../../utils/logging.js';
import { InjectDep } from '../tokens.js';
import { ApiKeyGuard, BodySchemaGuard, OrgId } from './guards.js';
import { ItemsService } from './itemsService.js';

@Controller('items')
export class ItemsController {
  constructor(
    @Inject(ItemsService) private readonly items: ItemsService,
    @InjectDep('Tracer') private readonly tracer: Dependencies['Tracer'],
  ) {}

  // Nest matches routes without a trailing slash too, like Express did for
  // the old `/async/` path.
  @Post('async')
  @UseGuards(BodySchemaGuard(submitItemsInputSchema), ApiKeyGuard)
  async submit(
    @OrgId() orgId: string,
    @Body() body: SubmitItemsInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { status, processInline } = await this.items.submitItems(orgId, body);
    res.status(status);
    if (processInline) {
      // Runs once the 202 is sent, or the client has gone away: 'close' fires
      // in both cases, 'finish' only in the first. Failures are recorded on a
      // span, as the Express error handler did.
      res.once('close', () => {
        this.tracer
          .addActiveSpan(
            { resource: 'SubmitItems', operation: 'processInline' },
            async (span) => {
              try {
                await processInline();
              } catch (e: unknown) {
                span.recordException(e instanceof Error ? e : String(e));
                span.setStatus({ code: SpanStatusCode.ERROR });
              }
            },
          )
          .catch((e: unknown) => {
            // eslint-disable-next-line no-restricted-syntax
            logErrorJson({
              message: 'inline item processing failed',
              error: e,
            });
          });
      });
    }
  }
}
