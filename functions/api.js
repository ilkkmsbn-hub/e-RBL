import { handleApi } from '../relay/handler.mjs';
export function onRequest(context) {
  return handleApi(context.request, context.env);
}
