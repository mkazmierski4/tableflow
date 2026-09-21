import { tokenStorage } from '@/lib/token-storage';

import { createApiClient, resolveBaseUrl } from './client';
import type { components } from './schema';

export { ApiError, type FieldErrors } from './client';

type Schemas = components['schemas'];

export type User = Schemas['UserRead'];
export type UserRole = User['role'];
export type Restaurant = Schemas['RestaurantRead'];
export type RestaurantPage = Schemas['Page_RestaurantRead_'];
export type DiningTable = Schemas['TableRead'];
export type RegisterInput = Schemas['UserRegister'];
export type Reservation = Schemas['ReservationRead'];
export type ReservationStatus = Reservation['status'];
export type ReservationPage = Schemas['Page_ReservationRead_'];
export type ReservationCreate = Schemas['ReservationCreate'];
export type ReservationUpdate = Schemas['ReservationUpdate'];
export type Slots = Schemas['SlotsRead'];
export type Slot = Schemas['SlotRead'];
export type Availability = Schemas['AvailabilityRead'];

const API = '/api/v1';

/** The app-wide client; the token comes from secure storage on every request. */
export const api = createApiClient({
  baseUrl: resolveBaseUrl(),
  getToken: () => tokenStorage.get(),
});

export const authApi = {
  login: (email: string, password: string, signal?: AbortSignal) =>
    api.request<Schemas['TokenRead']>('POST', `${API}/auth/login`, {
      // OAuth2 password flow: the e-mail travels as `username`.
      form: { username: email, password },
      auth: 'none',
      signal,
    }),
  register: (input: RegisterInput) =>
    api.request<User>('POST', `${API}/auth/register`, { json: input, auth: 'none' }),
  me: (signal?: AbortSignal) => api.request<User>('GET', `${API}/auth/me`, { signal }),
};

export type RestaurantListParams = { city?: string | null; limit?: number; offset?: number };

export const restaurantApi = {
  list: ({ city, limit = 100, offset = 0 }: RestaurantListParams = {}, signal?: AbortSignal) =>
    api.request<RestaurantPage>('GET', `${API}/restaurants`, {
      query: { city, limit, offset },
      auth: 'none',
      signal,
    }),
  cities: (signal?: AbortSignal) =>
    api.request<string[]>('GET', `${API}/restaurants/cities`, { auth: 'none', signal }),
  get: (id: number, signal?: AbortSignal) =>
    api.request<Restaurant>('GET', `${API}/restaurants/${id}`, { auth: 'none', signal }),
  tables: (id: number, signal?: AbortSignal) =>
    api.request<DiningTable[]>('GET', `${API}/restaurants/${id}/tables`, { auth: 'none', signal }),
  /** Start times of one local day with how many tables are free for the party. */
  slots: (id: number, params: { date: string; party_size: number }, signal?: AbortSignal) =>
    api.request<Slots>('GET', `${API}/restaurants/${id}/availability/slots`, {
      query: params,
      auth: 'none',
      signal,
    }),
  /** Free tables for one slot, smallest fitting table first. */
  availability: (
    id: number,
    params: { start_at: string; party_size: number },
    signal?: AbortSignal,
  ) =>
    api.request<Availability>('GET', `${API}/restaurants/${id}/availability`, {
      query: params,
      auth: 'none',
      signal,
    }),
};

export type ReservationListParams = {
  status?: ReservationStatus;
  restaurant_id?: number;
  limit?: number;
  offset?: number;
};

export const reservationApi = {
  list: (
    { limit = 100, offset = 0, ...filters }: ReservationListParams = {},
    signal?: AbortSignal,
  ) =>
    api.request<ReservationPage>('GET', `${API}/reservations`, {
      query: { ...filters, limit, offset },
      signal,
    }),
  get: (id: number, signal?: AbortSignal) =>
    api.request<Reservation>('GET', `${API}/reservations/${id}`, { signal }),
  create: (body: ReservationCreate) =>
    api.request<Reservation>('POST', `${API}/reservations`, { json: body }),
  update: (id: number, body: ReservationUpdate) =>
    api.request<Reservation>('PATCH', `${API}/reservations/${id}`, { json: body }),
  cancel: (id: number) => api.request<Reservation>('POST', `${API}/reservations/${id}/cancel`),
};
