import type { RequestHandler } from 'express';
import _Ajv from 'ajv-draft-04';

const Ajv = _Ajv as unknown as typeof _Ajv.default;
const ajv = new Ajv();

export function createBodySchemaValidator(
  schema: Record<string, unknown>,
): RequestHandler {
  const validate = ajv.compile(schema);
  return (req, res, next) => {
    if (validate(req.body)) {
      next();
    } else {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Request body failed schema validation',
        details: validate.errors,
      });
    }
  };
}
