import { handleApi } from '../relay/handler.mjs';
export default {
  fetch(request, env) { return handleApi(request, env); }
};
