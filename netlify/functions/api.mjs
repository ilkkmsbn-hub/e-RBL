import { handleApi } from '../../relay/handler.mjs';
export default async function handler(request) {
  return handleApi(request, process.env);
}
