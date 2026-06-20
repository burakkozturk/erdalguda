import { request } from './client';
import type { ExpressRegistrationRequest, ExpressRegistrationResponse } from '../types/expressRegistration';

export function createExpressRegistration(data: ExpressRegistrationRequest): Promise<ExpressRegistrationResponse> {
  return request<ExpressRegistrationResponse>('/express-registration', {
    method: 'POST',
    body: data,
  });
}
