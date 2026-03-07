import type {
  User,
  RankingCase,
  RankingCaseSave,
  Criterion,
  CriterionSave,
  Apartment,
  ApartmentSave,
  ApartmentCriterionValue,
  RankedApartment,
} from "../types/models";

export type ResponseType = "json" | "text" | "void";

interface RequestOptions extends RequestInit {
  responseType?: ResponseType;
}

async function request<T = void>(url: string, options: RequestOptions = {}): Promise<T> {
  const { responseType = "json", headers, ...rest } = options;

  const res = await fetch(url, {
    credentials: "include",
    ...rest,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(errorText || `Request failed: ${res.status}`);
  }

  if (responseType === "void") return undefined as T;
  if (responseType === "text") return (await res.text()) as T;

  const raw = await res.text();
  const trimmed = raw.trim();
  if (!trimmed) return undefined as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse JSON response: ${message}`);
  }
}

const jsonHeaders = { "Content-Type": "application/json" };

export const homeApi = {
  getStatus: () => request<string>("/api/home/status", { responseType: "text" }),
};

export const accountApi = {
  getInfo: () => request<User>("/api/account/info"),
  logout: () => request<void>("/api/account/logout", { method: "POST", responseType: "void" }),
  getUnapproved: () => request<User[]>("/api/account/unapproved"),
  approve: (userId: number) =>
    request<void>(`/api/account/approve?userId=${userId}`, { method: "POST", responseType: "void" }),
};

export const rankingCaseApi = {
  getAll: () => request<RankingCase[]>("/api/rankingcase/getall"),
  getById: (id: string) => request<RankingCase>(`/api/rankingcase/getbyid?id=${id}`),
  create: (data: RankingCaseSave) =>
    request<RankingCase>("/api/rankingcase/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  update: (data: RankingCase) =>
    request<RankingCase>("/api/rankingcase/update", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/api/rankingcase/delete?id=${id}`, { method: "DELETE", responseType: "void" }),
};

export const criterionApi = {
  getByRankingCaseId: (rankingCaseId: string) =>
    request<Criterion[]>(`/api/criterion/getbyrankingcaseid?rankingCaseId=${rankingCaseId}`),
  getById: (id: string) => request<Criterion>(`/api/criterion/getbyid?id=${id}`),
  create: (data: CriterionSave) =>
    request<Criterion>("/api/criterion/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  update: (data: Criterion) =>
    request<Criterion>("/api/criterion/update", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/api/criterion/delete?id=${id}`, { method: "DELETE", responseType: "void" }),
};

export const apartmentApi = {
  getByRankingCaseId: (rankingCaseId: string) =>
    request<Apartment[]>(`/api/apartment/getbyrankingcaseid?rankingCaseId=${rankingCaseId}`),
  getById: (id: string) => request<Apartment>(`/api/apartment/getbyid?id=${id}`),
  create: (data: ApartmentSave) =>
    request<Apartment>("/api/apartment/create", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  update: (data: Apartment) =>
    request<Apartment>("/api/apartment/update", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/api/apartment/delete?id=${id}`, { method: "DELETE", responseType: "void" }),
  upsertValue: (data: Omit<ApartmentCriterionValue, "id">) =>
    request<void>("/api/apartment/upsertvalue", {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(data),
      responseType: "void",
    }),
  deleteValue: (apartmentId: string, criterionId: string) =>
    request<void>(
      `/api/apartment/deletevalue?apartmentId=${apartmentId}&criterionId=${criterionId}`,
      { method: "DELETE", responseType: "void" }
    ),
};

export const rankingApi = {
  getRankings: (rankingCaseId: string) =>
    request<RankedApartment[]>(`/api/ranking/getrankings?rankingCaseId=${rankingCaseId}`),
};
