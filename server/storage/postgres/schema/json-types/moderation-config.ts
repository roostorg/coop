// Shapes of moderation-config jsonb columns, attached with `.$type<...>()`.
import { type JsonObject, type JsonValue } from 'type-fest';

/** `action_parameters` on rules_and_actions / user_strike_thresholds. */
export type ActionParametersJson = JsonObject;

/** `callback_url_headers` / `callback_url_body` on actions. */
export type CallbackJson = JsonObject;

/** One element of `actions.custom_mrt_api_params` (jsonb[]). */
export type CustomMrtApiParamJson = JsonValue;
