import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, useRouteError, isRouteErrorResponse, useLoaderData, Meta, Links, ScrollRestoration, Scripts, useSearchParams, useMatches, Link, useNavigate, useNavigation, useActionData, Form, data, redirect } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createContext, useContext, useMemo, useState, useEffect } from "react";
const ABORT_DELAY = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext) {
  const useOnAllReady = isbot(request.headers.get("user-agent") ?? "");
  return new Promise((resolve, reject) => {
    let didError = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [useOnAllReady ? "onAllReady" : "onShellReady"]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError: (err) => reject(err),
        onError: (err) => {
          didError = true;
          console.error(err);
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
const common$2 = { "appName": "Bookla", "back": "Geri", "next": "Növbəti", "loading": "Yüklənir…", "tryAgain": "Yenidən cəhd et" };
const landing$2 = { "title": "Bookla", "description": "Bir biznesin bron səhifəsinə daxil olmaq üçün düzgün linki istifadə edin.", "notFoundTitle": "Səhifə tapılmadı", "notFoundDescription": "Açmaq istədiyiniz ünvan mövcud deyil." };
const booking$2 = { "stepLabel": "{{current}}/{{total}}", "steps": { "service": "Xidmət", "staff": "Usta", "date": "Tarix", "slot": "Vaxt", "form": "Məlumatlar" }, "service": { "title": "Xidmət seçin", "subtitle": "Bron etmək istədiyiniz xidməti seçin.", "durationMinutes": "{{minutes}} dəq", "empty": "Bu biznesin hazırda aktiv xidməti yoxdur." }, "staff": { "title": "Usta seçin", "subtitle": "Sizə xidmət göstərəcək ustanı seçin.", "empty": "Bu biznesdə aktiv usta yoxdur." }, "date": { "title": "Tarix seçin", "subtitle": "Növbəti 14 gün arasından bir gün seçin.", "disabled": { "off": "bağlı", "full": "dolu" }, "weekday": { "0": "B.e", "1": "Ç.a", "2": "Ç", "3": "C.a", "4": "C", "5": "Ş", "6": "B" } }, "slot": { "title": "Vaxt seçin", "subtitle": "Xidmət {{minutes}} dəq davam edir. Başlama vaxtını seçin:", "loading": "Vaxtlar yüklənir…", "empty": "Bu gün üçün boş vaxt yoxdur. Başqa tarix seçin.", "error": "Vaxtları yükləmək alınmadı.", "sections": { "morning": "Səhər", "afternoon": "Günorta", "evening": "Axşam" } }, "form": { "title": "Məlumatlarınız", "subtitle": "Bron təsdiqi üçün əlaqə üsulu.", "nameLabel": "Ad", "namePlaceholder": "Adınız", "phoneLabel": "Telefon", "phonePlaceholder": "+994501234567", "emailLabel": "E-poçt (istəyə bağlı)", "emailPlaceholder": "siz@nümunə.az", "notesLabel": "Qeyd (istəyə bağlı)", "notesPlaceholder": "Bizə bildirmək istədiyiniz nəsə", "summaryTitle": "Bron məlumatları", "summaryService": "Xidmət", "summaryStaff": "Usta", "summaryDate": "Tarix", "summaryTime": "Vaxt", "summaryDuration": "Müddət", "summaryPrice": "Qiymət", "durationValue": "{{minutes}} dəq", "submit": "Bronu təsdiqlə", "submitting": "Göndərilir…", "errors": { "generic": "Bron yaratmaq alınmadı. Yenidən cəhd edin.", "slotTaken": "Bu vaxt artıq tutulub. Başqa vaxt seçin.", "invalid": "Məlumatlarınızı yoxlayın.", "blocked": "Bu telefon nömrəsi hazırda burada bron edə bilməz. Zəhmət olmasa biznes ilə birbaşa əlaqə saxlayın." } } };
const confirmation$2 = { "title": "Bron təsdiqləndi", "subtitle": "Detallar aşağıdadır. Linki saxlayın və ya əlinizdə saxlayın.", "labels": { "service": "Xidmət", "staff": "Usta", "date": "Tarix", "time": "Vaxt", "duration": "Müddət", "price": "Qiymət", "notes": "Qeyd", "client": "Sizin haqqınızda", "business": "Biznes" }, "notFoundTitle": "Bron tapılmadı", "notFoundDescription": "Bu link köhnə və ya yanlış ola bilər.", "newBookingAction": "Başqa bron yarat" };
const az = {
  common: common$2,
  landing: landing$2,
  booking: booking$2,
  confirmation: confirmation$2
};
const common$1 = { "appName": "Bookla", "back": "Back", "next": "Next", "loading": "Loading…", "tryAgain": "Try again" };
const landing$1 = { "title": "Bookla", "description": "Use the exact link a business shared with you to open their booking page.", "notFoundTitle": "Page not found", "notFoundDescription": "We couldn't find what you're looking for." };
const booking$1 = { "stepLabel": "{{current}} of {{total}}", "steps": { "service": "Service", "staff": "Staff", "date": "Date", "slot": "Time", "form": "Your details" }, "service": { "title": "Pick a service", "subtitle": "Choose what you'd like to book.", "durationMinutes": "{{minutes}} min", "empty": "This business has no active services yet." }, "staff": { "title": "Pick a staff member", "subtitle": "Who would you like to see?", "empty": "No active staff yet." }, "date": { "title": "Pick a date", "subtitle": "Choose any day in the next two weeks.", "disabled": { "off": "closed", "full": "full" }, "weekday": { "0": "Mon", "1": "Tue", "2": "Wed", "3": "Thu", "4": "Fri", "5": "Sat", "6": "Sun" } }, "slot": { "title": "Pick a time", "subtitle": "The service takes {{minutes}} min. Pick a start time:", "loading": "Loading times…", "empty": "No times available on this day. Try another date.", "error": "Could not load times.", "sections": { "morning": "Morning", "afternoon": "Afternoon", "evening": "Evening" } }, "form": { "title": "Your details", "subtitle": "We'll use this to confirm your booking.", "nameLabel": "Name", "namePlaceholder": "Your name", "phoneLabel": "Phone", "phonePlaceholder": "+994501234567", "emailLabel": "Email (optional)", "emailPlaceholder": "you@example.com", "notesLabel": "Notes (optional)", "notesPlaceholder": "Anything we should know", "summaryTitle": "Booking summary", "summaryService": "Service", "summaryStaff": "Staff", "summaryDate": "Date", "summaryTime": "Time", "summaryDuration": "Duration", "summaryPrice": "Price", "durationValue": "{{minutes}} min", "submit": "Confirm booking", "submitting": "Sending…", "errors": { "generic": "Could not create the booking. Try again.", "slotTaken": "That time was just taken. Please pick another.", "invalid": "Please check the details and try again.", "blocked": "This phone can't book at this business right now. Please contact them directly." } } };
const confirmation$1 = { "title": "Booking confirmed", "subtitle": "Here are the details. Keep this link for your records.", "labels": { "service": "Service", "staff": "Staff", "date": "Date", "time": "Time", "duration": "Duration", "price": "Price", "notes": "Notes", "client": "Booked for", "business": "Business" }, "notFoundTitle": "Booking not found", "notFoundDescription": "This link may be stale or incorrect.", "newBookingAction": "Make another booking" };
const en = {
  common: common$1,
  landing: landing$1,
  booking: booking$1,
  confirmation: confirmation$1
};
const common = { "appName": "Bookla", "back": "Назад", "next": "Далее", "loading": "Загрузка…", "tryAgain": "Попробовать снова" };
const landing = { "title": "Bookla", "description": "Чтобы открыть страницу бронирования, используйте ссылку, отправленную бизнесом.", "notFoundTitle": "Страница не найдена", "notFoundDescription": "Запрошенный адрес не существует." };
const booking = { "stepLabel": "{{current}} из {{total}}", "steps": { "service": "Услуга", "staff": "Мастер", "date": "Дата", "slot": "Время", "form": "Данные" }, "service": { "title": "Выберите услугу", "subtitle": "Что вы хотите забронировать?", "durationMinutes": "{{minutes}} мин", "empty": "У этого бизнеса пока нет активных услуг." }, "staff": { "title": "Выберите мастера", "subtitle": "К кому вы хотите записаться?", "empty": "Нет активных мастеров." }, "date": { "title": "Выберите дату", "subtitle": "Любой день в ближайшие две недели.", "disabled": { "off": "выходной", "full": "занято" }, "weekday": { "0": "Пн", "1": "Вт", "2": "Ср", "3": "Чт", "4": "Пт", "5": "Сб", "6": "Вс" } }, "slot": { "title": "Выберите время", "subtitle": "Услуга длится {{minutes}} мин. Выберите время начала:", "loading": "Загружаем время…", "empty": "На этот день свободного времени нет. Попробуйте другую дату.", "error": "Не удалось загрузить время.", "sections": { "morning": "Утро", "afternoon": "День", "evening": "Вечер" } }, "form": { "title": "Ваши данные", "subtitle": "Понадобятся для подтверждения брони.", "nameLabel": "Имя", "namePlaceholder": "Ваше имя", "phoneLabel": "Телефон", "phonePlaceholder": "+994501234567", "emailLabel": "Email (необязательно)", "emailPlaceholder": "you@example.com", "notesLabel": "Комментарий (необязательно)", "notesPlaceholder": "Что-то, что нам следует знать", "summaryTitle": "Сводка брони", "summaryService": "Услуга", "summaryStaff": "Мастер", "summaryDate": "Дата", "summaryTime": "Время", "summaryDuration": "Длительность", "summaryPrice": "Цена", "durationValue": "{{minutes}} мин", "submit": "Подтвердить бронь", "submitting": "Отправляем…", "errors": { "generic": "Не удалось создать бронь. Попробуйте снова.", "slotTaken": "Это время только что заняли. Выберите другое.", "invalid": "Проверьте данные и повторите.", "blocked": "С этого номера сейчас нельзя забронировать у этого бизнеса. Свяжитесь с ними напрямую." } } };
const confirmation = { "title": "Бронь подтверждена", "subtitle": "Сохраните ссылку — она пригодится.", "labels": { "service": "Услуга", "staff": "Мастер", "date": "Дата", "time": "Время", "duration": "Длительность", "price": "Цена", "notes": "Комментарий", "client": "Кому забронировано", "business": "Бизнес" }, "notFoundTitle": "Бронь не найдена", "notFoundDescription": "Ссылка устарела или указана неверно.", "newBookingAction": "Сделать ещё одну бронь" };
const ru = {
  common,
  landing,
  booking,
  confirmation
};
const SUPPORTED_LOCALES = ["az", "en", "ru"];
const DEFAULT_LOCALE = "az";
const catalogs = { az, en, ru };
const isSupported = (v) => SUPPORTED_LOCALES.includes(v);
const detectLocale = (acceptLanguage, url) => {
  const q = url.searchParams.get("lang");
  if (q) {
    const norm = q.trim().toLowerCase();
    if (isSupported(norm)) return norm;
  }
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(",")) {
      const code = part.split(/[;-]/)[0]?.trim().toLowerCase();
      if (code && isSupported(code)) return code;
    }
  }
  return DEFAULT_LOCALE;
};
const lookup = (locale, key) => {
  const parts = key.split(".");
  let cur = catalogs[locale];
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return void 0;
    }
  }
  return typeof cur === "string" ? cur : void 0;
};
const interpolate = (str, vars) => {
  if (!vars) return str;
  return str.replace(
    /\{\{(\w+)\}\}/g,
    (_, k) => k in vars ? String(vars[k]) : `{{${k}}}`
  );
};
const makeT = (locale) => {
  return (key, vars) => {
    const raw = lookup(locale, key) ?? (locale === DEFAULT_LOCALE ? void 0 : lookup(DEFAULT_LOCALE, key));
    return interpolate(raw ?? key, vars);
  };
};
const I18nContext = createContext({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE)
});
const I18nProvider = ({
  locale,
  children
}) => {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return /* @__PURE__ */ jsx(I18nContext.Provider, { value, children });
};
const useI18n = () => useContext(I18nContext);
const useT = () => useContext(I18nContext).t;
const styles = "/assets/styles-VrkA8Juo.css";
const links = () => [{
  rel: "stylesheet",
  href: styles
}, {
  rel: "preconnect",
  href: "https://fonts.googleapis.com"
}, {
  rel: "preconnect",
  href: "https://fonts.gstatic.com",
  crossOrigin: "anonymous"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
}];
const loader$2 = ({
  request
}) => {
  const url = new URL(request.url);
  const locale = detectLocale(request.headers.get("accept-language"), url);
  return {
    locale
  };
};
function Layout({
  children
}) {
  const data2 = useLoaderData();
  const locale = data2?.locale ?? DEFAULT_LOCALE;
  return /* @__PURE__ */ jsxs("html", {
    lang: locale,
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover"
      }), /* @__PURE__ */ jsx("meta", {
        name: "theme-color",
        content: "#fdfaf3"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      className: "min-h-dvh bg-cream-50 text-ink-700",
      children: [/* @__PURE__ */ jsx(I18nProvider, {
        locale,
        children
      }), /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2() {
  const error = useRouteError();
  return /* @__PURE__ */ jsx(ErrorView, {
    error
  });
});
const ErrorView = ({
  error
}) => {
  const t = useT();
  const isRouteError = isRouteErrorResponse(error);
  const status = isRouteError ? error.status : 500;
  const title = status === 404 ? t("landing.notFoundTitle") : t("landing.notFoundDescription");
  return /* @__PURE__ */ jsxs("main", {
    className: "px-safe mx-auto flex min-h-dvh w-full max-w-[var(--container-app)] flex-col items-center justify-center gap-3 p-6 text-center",
    children: [/* @__PURE__ */ jsx("p", {
      className: "text-sm font-semibold tracking-wide text-gold-600",
      children: status
    }), /* @__PURE__ */ jsx("h1", {
      className: "text-xl font-semibold text-ink-700",
      children: title
    }), isRouteError && error.data ? /* @__PURE__ */ jsx("p", {
      className: "text-sm text-ink-400",
      children: String(error.data)
    }) : null]
  });
};
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (hhmm) => {
  const m = HHMM_RE.exec(hhmm);
  if (!m) throw new Error(`Invalid HH:MM value: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const fromMinutes = (total) => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const addMinutes = (hhmm, minutes) => {
  return fromMinutes(toMinutes(hhmm) + minutes);
};
const SERVER_DEFAULT = "http://localhost:4200";
const CLIENT_DEFAULT = "http://localhost:4200";
const isServer = typeof window === "undefined";
const baseUrl = () => {
  if (isServer) {
    return process.env.INTERNAL_API_URL ?? SERVER_DEFAULT;
  }
  return CLIENT_DEFAULT;
};
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
  status;
  code;
}
const buildUrl = (path, query) => {
  const url = new URL(path, baseUrl());
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== void 0 && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};
const apiFetch = async (path, options = {}) => {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.body !== void 0) headers.set("Content-Type", "application/json");
  if (options.request) {
    const accept = options.request.headers.get("accept-language");
    if (accept) headers.set("Accept-Language", accept);
  }
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== void 0 ? JSON.stringify(options.body) : void 0
  });
  if (!res.ok) {
    let code;
    let message = `HTTP ${res.status}`;
    try {
      const data2 = await res.json();
      if (data2.code) code = data2.code;
      if (data2.error) message = data2.error;
    } catch {
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return void 0;
  return await res.json();
};
const fetchPublicBusiness = (slug, request) => apiFetch(`/public/business/${encodeURIComponent(slug)}`, { request });
const fetchPublicSlots = (slug, query, request) => apiFetch(`/public/business/${encodeURIComponent(slug)}/slots`, {
  request,
  query
});
const fetchPublicCalendar = (slug, query, request) => apiFetch(
  `/public/business/${encodeURIComponent(slug)}/calendar`,
  { request, query }
);
const createPublicBooking = (dto, request) => apiFetch("/public/bookings", {
  method: "POST",
  body: dto,
  request
});
const fetchPublicBooking = (publicId, request) => apiFetch(
  `/public/bookings/${encodeURIComponent(publicId)}`,
  { request }
);
const formatPrice = (priceAmount, currency) => {
  const amount = (priceAmount / 100).toFixed(2);
  if (currency === "AZN") return `${amount} ₼`;
  return `${amount} ${currency}`;
};
const durationUnit = (locale) => {
  if (locale === "az") return "dəq";
  if (locale === "ru") return "мин";
  return "min";
};
const BusinessHeader = ({ tenant }) => {
  return /* @__PURE__ */ jsxs("header", { className: "flex items-center gap-3", children: [
    tenant.avatarUrl ? /* @__PURE__ */ jsx(
      "img",
      {
        src: tenant.avatarUrl,
        alt: "",
        className: "h-12 w-12 shrink-0 rounded-full border border-cream-300 object-cover"
      }
    ) : /* @__PURE__ */ jsx("div", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-cream-100 text-base font-semibold text-gold-600", children: tenant.name.slice(0, 1).toUpperCase() }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx("h1", { className: "truncate text-lg font-semibold text-ink-700", children: tenant.name }),
      tenant.address ? /* @__PURE__ */ jsx("p", { className: "truncate text-sm text-ink-400", children: tenant.address }) : null
    ] })
  ] });
};
const PageShell = ({ children }) => {
  return /* @__PURE__ */ jsx("main", { className: "mx-auto flex min-h-dvh w-full max-w-[var(--container-app)] flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] sm:max-w-lg sm:pt-[calc(env(safe-area-inset-top)+3rem)]", children });
};
const StepProgress = ({ current, total }) => {
  const t = useT();
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
    /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-wider text-ink-400", children: t("booking.stepLabel", { current, total }) }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-1 gap-1 pl-4", children: Array.from({ length: total }, (_, i) => /* @__PURE__ */ jsx(
      "div",
      {
        className: `h-1 flex-1 rounded-full ${i < current ? "bg-gold-500" : "bg-cream-200"}`,
        "aria-hidden": true
      },
      i
    )) })
  ] });
};
const STEPS = ["service", "staff", "date", "slot", "form"];
const parseStep = (raw) => {
  if (raw && STEPS.includes(raw)) return raw;
  return "service";
};
const readParams = (sp) => ({
  step: parseStep(sp.get("step")),
  serviceId: sp.get("serviceId") ? Number(sp.get("serviceId")) : null,
  staffId: sp.get("staffId") ? Number(sp.get("staffId")) : null,
  date: sp.get("date"),
  startTime: sp.get("startTime")
});
const writeParams = (existing, patch) => {
  const sp = new URLSearchParams(existing);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === void 0 || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  return sp.toString();
};
const CALENDAR_WINDOW_DAYS = 14;
const todayInTimezone = (timezone) => {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(/* @__PURE__ */ new Date()).split(" ")[0];
};
const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};
const loader$1 = async ({
  params,
  request
}) => {
  const slug = params.slug;
  if (!slug) throw data("Missing slug", {
    status: 404
  });
  let business;
  try {
    business = await fetchPublicBusiness(slug, request);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw data("Business not found", {
        status: 404
      });
    }
    throw err;
  }
  const url = new URL(request.url);
  const sp = url.searchParams;
  const rawServiceId = sp.get("serviceId");
  const rawStaffId = sp.get("staffId");
  const serviceId = rawServiceId ? Number(rawServiceId) : null;
  const staffId = rawStaffId != null ? Number(rawStaffId) : business.staff.length === 1 ? business.staff[0].id : null;
  const from = todayInTimezone(business.tenant.timezone);
  const to = addDaysISO(from, CALENDAR_WINDOW_DAYS - 1);
  const windowDates = [];
  for (let i = 0; i < CALENDAR_WINDOW_DAYS; i++) windowDates.push(addDaysISO(from, i));
  let calendarDays = null;
  if (serviceId && staffId && Number.isFinite(serviceId) && Number.isFinite(staffId)) {
    try {
      calendarDays = await fetchPublicCalendar(slug, {
        staffId,
        serviceId,
        from,
        to
      }, request);
    } catch {
      calendarDays = null;
    }
  }
  return {
    business,
    slug,
    calendarDays,
    windowDates
  };
};
const meta$2 = ({
  data: d
}) => {
  if (!d) return [{
    title: "Bookla"
  }];
  return [{
    title: `${d.business.tenant.name} — Bookla`
  }, {
    name: "description",
    content: d.business.tenant.description ?? ""
  }];
};
const action = async ({
  request,
  params
}) => {
  const slug = params.slug;
  if (!slug) throw data("Missing slug", {
    status: 404
  });
  const form = await request.formData();
  const get = (k) => (form.get(k) ?? "").toString();
  const emailRaw = get("clientEmail").trim();
  const payload = {
    slug,
    serviceId: Number(get("serviceId")),
    staffId: Number(get("staffId")),
    date: get("date"),
    startTime: get("startTime"),
    client: {
      name: get("clientName").trim(),
      phone: get("clientPhone").trim(),
      // Empty input → omit so the API treats it as "not provided" rather than
      // an invalid-email validation failure.
      ...emailRaw && {
        email: emailRaw
      }
    },
    notes: get("notes").trim() || void 0
  };
  if (!Number.isFinite(payload.serviceId) || !Number.isFinite(payload.staffId) || !payload.date || !payload.startTime || !payload.client.name || !payload.client.phone) {
    return data({
      ok: false,
      errorCode: "invalid"
    }, {
      status: 400
    });
  }
  try {
    const created = await createPublicBooking(payload, request);
    return redirect(`/b/${encodeURIComponent(slug)}/confirmation/${created.publicId}`);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "SLOT_UNAVAILABLE") {
        return data({
          ok: false,
          errorCode: "slotTaken"
        }, {
          status: 409
        });
      }
      if (err.code === "PHONE_BLOCKED") {
        return data({
          ok: false,
          errorCode: "blocked"
        }, {
          status: 403
        });
      }
      if (err.status >= 400 && err.status < 500) {
        return data({
          ok: false,
          errorCode: "invalid"
        }, {
          status: err.status
        });
      }
    }
    return data({
      ok: false,
      errorCode: "generic"
    }, {
      status: 500
    });
  }
};
const b_$slug = UNSAFE_withComponentProps(function BookingFlowRoute() {
  const {
    business,
    slug,
    calendarDays,
    windowDates
  } = useLoaderData();
  const [searchParams] = useSearchParams();
  const flow = readParams(searchParams);
  const matches = useMatches();
  const hasChildMatch = matches.some((m) => m.id !== "routes/b.$slug" && m.id.startsWith("routes/b.$slug."));
  if (hasChildMatch) return /* @__PURE__ */ jsx(Outlet, {});
  const effectiveStaffId = flow.staffId ?? (business.staff.length === 1 ? business.staff[0].id : null);
  const skipStaff = business.staff.length <= 1;
  const visibleSteps = skipStaff ? ["service", "date", "slot", "form"] : ["service", "staff", "date", "slot", "form"];
  const stepIndex = Math.max(0, visibleSteps.indexOf(flow.step));
  const stepNumber = stepIndex + 1;
  return /* @__PURE__ */ jsxs(PageShell, {
    children: [/* @__PURE__ */ jsx(BusinessHeader, {
      tenant: business.tenant
    }), /* @__PURE__ */ jsx(StepProgress, {
      current: stepNumber,
      total: visibleSteps.length
    }), /* @__PURE__ */ jsx(FlowStep, {
      flow: {
        ...flow,
        staffId: effectiveStaffId
      },
      slug,
      business,
      calendarDays,
      windowDates,
      skipStaff
    })]
  });
});
const FlowStep = (props) => {
  const {
    flow
  } = props;
  switch (flow.step) {
    case "service":
      return /* @__PURE__ */ jsx(ServiceStep, {
        ...props
      });
    case "staff":
      return /* @__PURE__ */ jsx(StaffStep, {
        ...props
      });
    case "date":
      return /* @__PURE__ */ jsx(DateStep, {
        ...props
      });
    case "slot":
      return /* @__PURE__ */ jsx(SlotStep, {
        ...props
      });
    case "form":
      return /* @__PURE__ */ jsx(FormStep, {
        ...props
      });
  }
};
const BackLink = ({
  to
}) => {
  const t = useT();
  return /* @__PURE__ */ jsxs(Link, {
    to,
    className: "-ml-1 inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-sm font-medium text-ink-500 hover:text-ink-700",
    children: [/* @__PURE__ */ jsx("span", {
      "aria-hidden": true,
      children: "←"
    }), /* @__PURE__ */ jsx("span", {
      children: t("common.back")
    })]
  });
};
const ServiceStep = ({
  business,
  skipStaff
}) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  return /* @__PURE__ */ jsxs("section", {
    className: "flex flex-col gap-4",
    children: [/* @__PURE__ */ jsxs("header", {
      children: [/* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("booking.service.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("booking.service.subtitle")
      })]
    }), business.services.length === 0 ? /* @__PURE__ */ jsx("p", {
      className: "rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400",
      children: t("booking.service.empty")
    }) : /* @__PURE__ */ jsx("ul", {
      className: "flex flex-col gap-2",
      children: business.services.map((service) => {
        const nextStep = skipStaff ? "date" : "staff";
        const search = writeParams(searchParams, {
          step: nextStep,
          serviceId: service.id,
          // Clear any later state when switching service.
          date: null,
          startTime: null,
          staffId: null
        });
        return /* @__PURE__ */ jsx("li", {
          children: /* @__PURE__ */ jsxs(Link, {
            to: {
              search: `?${search}`
            },
            className: "flex w-full items-center justify-between gap-4 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-left transition-colors hover:bg-cream-100",
            children: [/* @__PURE__ */ jsxs("span", {
              className: "min-w-0",
              children: [/* @__PURE__ */ jsx("span", {
                className: "block truncate font-medium text-ink-700",
                children: service.name
              }), /* @__PURE__ */ jsx("span", {
                className: "block text-xs text-ink-400",
                children: t("booking.service.durationMinutes", {
                  minutes: service.durationMinutes
                })
              })]
            }), /* @__PURE__ */ jsx("span", {
              className: "shrink-0 text-sm font-semibold text-gold-600",
              children: formatPrice(service.priceAmount, service.currency)
            })]
          })
        }, service.id);
      })
    })]
  });
};
const StaffStep = ({
  business
}) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  return /* @__PURE__ */ jsxs("section", {
    className: "flex flex-col gap-4",
    children: [/* @__PURE__ */ jsx(BackLink, {
      to: `?${writeParams(searchParams, {
        step: "service"
      })}`
    }), /* @__PURE__ */ jsxs("header", {
      children: [/* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("booking.staff.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("booking.staff.subtitle")
      })]
    }), business.staff.length === 0 ? /* @__PURE__ */ jsx("p", {
      className: "rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400",
      children: t("booking.staff.empty")
    }) : /* @__PURE__ */ jsx("ul", {
      className: "flex flex-col gap-2",
      children: business.staff.map((s) => {
        const search = writeParams(searchParams, {
          step: "date",
          staffId: s.id,
          date: null,
          startTime: null
        });
        return /* @__PURE__ */ jsx("li", {
          children: /* @__PURE__ */ jsxs(Link, {
            to: {
              search: `?${search}`
            },
            className: "flex w-full items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-left transition-colors hover:bg-cream-100",
            children: [/* @__PURE__ */ jsx(StaffAvatar, {
              staff: s
            }), /* @__PURE__ */ jsx("span", {
              className: "font-medium text-ink-700",
              children: s.name
            })]
          })
        }, s.id);
      })
    })]
  });
};
const StaffAvatar = ({
  staff
}) => {
  if (staff.avatarUrl) {
    return /* @__PURE__ */ jsx("img", {
      src: staff.avatarUrl,
      alt: "",
      className: "h-10 w-10 shrink-0 rounded-full border border-cream-300 object-cover"
    });
  }
  return /* @__PURE__ */ jsx("div", {
    className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-300 bg-cream-100 text-sm font-semibold text-gold-600",
    children: staff.name.slice(0, 1).toUpperCase()
  });
};
const isoToLocalNoonDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
const localDateToISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const jsDowToMonFirst = (d) => (d.getDay() + 6) % 7;
const DateStep = ({
  flow,
  skipStaff,
  calendarDays,
  windowDates
}) => {
  const t = useT();
  const {
    locale
  } = useI18n();
  const [searchParams] = useSearchParams();
  if (windowDates.length === 0) return null;
  const windowSet = new Set(windowDates);
  const statusByDate = /* @__PURE__ */ new Map();
  if (calendarDays) {
    for (const d of calendarDays) statusByDate.set(d.date, d.status);
  }
  const statusFor = (iso) => statusByDate.get(iso) ?? "open";
  const firstWinDate = isoToLocalNoonDate(windowDates[0]);
  const lastWinDate = isoToLocalNoonDate(windowDates[windowDates.length - 1]);
  const today = windowDates[0];
  const gridStart = new Date(firstWinDate);
  gridStart.setDate(firstWinDate.getDate() - jsDowToMonFirst(firstWinDate));
  const gridEnd = new Date(lastWinDate);
  gridEnd.setDate(lastWinDate.getDate() + (6 - jsDowToMonFirst(lastWinDate)));
  const gridDates = [];
  for (let i = 0; ; i++) {
    const cur = new Date(gridStart);
    cur.setDate(gridStart.getDate() + i);
    if (cur > gridEnd) break;
    gridDates.push(localDateToISO(cur));
  }
  const monthYearFmt = new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale, {
    month: "long",
    year: "numeric"
  });
  const firstMonth = monthYearFmt.format(firstWinDate);
  const lastMonth = monthYearFmt.format(lastWinDate);
  const headerLabel = firstMonth === lastMonth ? firstMonth : `${firstMonth} — ${lastMonth}`;
  return /* @__PURE__ */ jsxs("section", {
    className: "flex flex-col gap-4",
    children: [/* @__PURE__ */ jsx(BackLink, {
      to: `?${writeParams(searchParams, {
        step: skipStaff ? "service" : "staff"
      })}`
    }), /* @__PURE__ */ jsxs("header", {
      children: [/* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("booking.date.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("booking.date.subtitle")
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "rounded-2xl border border-cream-300 bg-cream-50 p-3",
      children: [/* @__PURE__ */ jsx("p", {
        className: "mb-3 text-center text-sm font-semibold capitalize text-ink-500",
        children: headerLabel
      }), /* @__PURE__ */ jsxs("div", {
        className: "grid grid-cols-7 gap-1.5",
        children: [[0, 1, 2, 3, 4, 5, 6].map((dow) => /* @__PURE__ */ jsx("div", {
          className: "pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400",
          children: t(`booking.date.weekday.${dow}`)
        }, `h${dow}`)), gridDates.map((iso) => {
          const inWindow = windowSet.has(iso);
          if (!inWindow) {
            return /* @__PURE__ */ jsx("div", {
              "aria-hidden": true,
              className: "h-14"
            }, iso);
          }
          const d = isoToLocalNoonDate(iso);
          const active = flow.date === iso;
          const status = statusFor(iso);
          const disabled = status !== "open";
          const isToday = iso === today;
          const baseCell = "flex h-14 flex-col items-center justify-center rounded-xl text-base relative";
          if (disabled) {
            const labelKey = `booking.date.disabled.${status}`;
            return /* @__PURE__ */ jsxs("span", {
              "aria-disabled": "true",
              "aria-label": `${d.getDate()} — ${t(labelKey)}`,
              className: `${baseCell} cursor-not-allowed text-ink-200 ${isToday ? "ring-1 ring-inset ring-cream-300" : ""}`,
              children: [/* @__PURE__ */ jsx("span", {
                className: "leading-none",
                children: d.getDate()
              }), /* @__PURE__ */ jsx("span", {
                className: "mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-200",
                children: t(labelKey)
              })]
            }, iso);
          }
          const search = writeParams(searchParams, {
            step: "slot",
            date: iso,
            startTime: null
          });
          return /* @__PURE__ */ jsx(Link, {
            to: {
              search: `?${search}`
            },
            className: `${baseCell} font-medium transition-colors ${active ? "bg-gold-500 text-cream-50" : isToday ? "bg-cream-100 text-ink-700 ring-1 ring-inset ring-gold-500 hover:bg-cream-200" : "bg-cream-100 text-ink-700 hover:bg-cream-200"}`,
            "aria-current": isToday ? "date" : void 0,
            children: /* @__PURE__ */ jsx("span", {
              className: "leading-none",
              children: d.getDate()
            })
          }, iso);
        })]
      })]
    })]
  });
};
const groupSlotsByPartOfDay = (slots) => {
  const buckets = {
    morning: [],
    afternoon: [],
    evening: []
  };
  for (const s of slots) {
    const h = Number(s.slice(0, 2));
    if (h < 12) buckets.morning.push(s);
    else if (h < 17) buckets.afternoon.push(s);
    else buckets.evening.push(s);
  }
  return ["morning", "afternoon", "evening"].map((key) => ({
    key,
    slots: buckets[key]
  })).filter((g) => g.slots.length > 0);
};
const SlotStep = ({
  business,
  flow,
  slug
}) => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const serviceId = flow.serviceId;
  const staffId = flow.staffId;
  const date = flow.date;
  const ready = serviceId != null && staffId != null && date != null;
  const service = business.services.find((s) => s.id === serviceId);
  const durationMinutes = service?.durationMinutes ?? 0;
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setSlots(null);
    setError(null);
    fetchPublicSlots(slug, {
      staffId,
      serviceId,
      date
    }).then((res) => {
      if (!cancelled) setSlots(res);
    }).catch(() => {
      if (!cancelled) setError(t("booking.slot.error"));
    });
    return () => {
      cancelled = true;
    };
  }, [slug, staffId, serviceId, date, ready, t]);
  if (!serviceId) {
    return /* @__PURE__ */ jsx(RedirectBack, {
      to: `?${writeParams(searchParams, {
        step: "service"
      })}`
    });
  }
  if (!staffId) {
    return /* @__PURE__ */ jsx(RedirectBack, {
      to: `?${writeParams(searchParams, {
        step: "staff"
      })}`
    });
  }
  if (!date) {
    return /* @__PURE__ */ jsx(RedirectBack, {
      to: `?${writeParams(searchParams, {
        step: "date"
      })}`
    });
  }
  const groups = slots ? groupSlotsByPartOfDay(slots) : [];
  return /* @__PURE__ */ jsxs("section", {
    className: "flex flex-col gap-4",
    children: [/* @__PURE__ */ jsx(BackLink, {
      to: `?${writeParams(searchParams, {
        step: "date"
      })}`
    }), /* @__PURE__ */ jsxs("header", {
      children: [/* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("booking.slot.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("booking.slot.subtitle", {
          minutes: durationMinutes
        })
      })]
    }), slots === null && !error ? /* @__PURE__ */ jsx(SlotsSkeleton, {
      label: t("booking.slot.loading")
    }) : error ? /* @__PURE__ */ jsx(ErrorBox, {
      message: error,
      retry: () => {
        navigate(0);
      }
    }) : slots && slots.length === 0 ? /* @__PURE__ */ jsx("p", {
      className: "rounded-xl border border-dashed border-cream-300 bg-cream-100 p-6 text-center text-sm text-ink-400",
      children: t("booking.slot.empty")
    }) : /* @__PURE__ */ jsx("div", {
      className: "flex flex-col gap-5",
      children: groups.map((group) => /* @__PURE__ */ jsxs("div", {
        className: "flex flex-col gap-2",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-[11px] font-semibold uppercase tracking-wider text-ink-400",
          children: t(`booking.slot.sections.${group.key}`)
        }), /* @__PURE__ */ jsx("div", {
          className: "grid grid-cols-2 gap-2 sm:grid-cols-3",
          children: group.slots.map((slot) => {
            const end = addMinutes(slot, durationMinutes);
            const search = writeParams(searchParams, {
              step: "form",
              startTime: slot
            });
            return /* @__PURE__ */ jsxs(Link, {
              to: {
                search: `?${search}`
              },
              className: "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-cream-300 bg-cream-50 transition-colors hover:bg-cream-100 active:bg-cream-200",
              children: [/* @__PURE__ */ jsx("span", {
                className: "text-base font-semibold leading-none text-ink-700",
                children: slot
              }), /* @__PURE__ */ jsxs("span", {
                className: "text-[11px] font-medium leading-none text-ink-400",
                children: ["→ ", end]
              })]
            }, slot);
          })
        })]
      }, group.key))
    })]
  });
};
const SlotsSkeleton = ({
  label
}) => /* @__PURE__ */ jsxs("div", {
  className: "flex flex-col gap-2",
  "aria-label": label,
  children: [/* @__PURE__ */ jsx("div", {
    className: "grid grid-cols-2 gap-2 sm:grid-cols-3",
    children: Array.from({
      length: 9
    }).map((_, i) => /* @__PURE__ */ jsx("div", {
      className: "h-14 animate-pulse rounded-xl bg-cream-200"
    }, i))
  }), /* @__PURE__ */ jsx("p", {
    className: "text-center text-xs text-ink-400",
    children: label
  })]
});
const ErrorBox = ({
  message,
  retry
}) => {
  const t = useT();
  return /* @__PURE__ */ jsxs("div", {
    className: "flex flex-col items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-center",
    children: [/* @__PURE__ */ jsx("p", {
      className: "text-sm text-danger-500",
      children: message
    }), /* @__PURE__ */ jsx("button", {
      type: "button",
      onClick: retry,
      className: "rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-cream-50 hover:bg-gold-600",
      children: t("common.tryAgain")
    })]
  });
};
const RedirectBack = ({
  to
}) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, {
      replace: true
    });
  }, [navigate, to]);
  return null;
};
const findRequirements = (flow, business) => {
  const service = business.services.find((s) => s.id === flow.serviceId);
  const staff = business.staff.find((s) => s.id === flow.staffId);
  if (!service || !staff || !flow.date || !flow.startTime) return null;
  return {
    service,
    staff,
    date: flow.date,
    startTime: flow.startTime
  };
};
const FormStep = ({
  business,
  flow,
  slug,
  skipStaff
}) => {
  const t = useT();
  const {
    locale
  } = useI18n();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const reqs = findRequirements(flow, business);
  if (!reqs) {
    return /* @__PURE__ */ jsx(RedirectBack, {
      to: `?${writeParams(searchParams, {
        step: "service"
      })}`
    });
  }
  const dateFmt = new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const niceDate = dateFmt.format(/* @__PURE__ */ new Date(`${reqs.date}T12:00:00`));
  const endTime = addMinutes(reqs.startTime, reqs.service.durationMinutes);
  const submitting = navigation.state === "submitting" || navigation.state === "loading";
  const actionData = useActionData();
  const errKey = actionData && actionData.ok === false ? `booking.form.errors.${actionData.errorCode}` : null;
  return /* @__PURE__ */ jsxs("section", {
    className: "flex flex-col gap-4",
    children: [/* @__PURE__ */ jsx(BackLink, {
      to: `?${writeParams(searchParams, {
        step: "slot"
      })}`
    }), /* @__PURE__ */ jsxs("header", {
      children: [/* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("booking.form.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("booking.form.subtitle")
      })]
    }), /* @__PURE__ */ jsxs("dl", {
      className: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-cream-300 bg-cream-50 p-4 text-sm",
      children: [/* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("booking.form.summaryService")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700",
        children: reqs.service.name
      }), !skipStaff ? /* @__PURE__ */ jsxs(Fragment, {
        children: [/* @__PURE__ */ jsx("dt", {
          className: "text-ink-400",
          children: t("booking.form.summaryStaff")
        }), /* @__PURE__ */ jsx("dd", {
          className: "text-right font-medium text-ink-700",
          children: reqs.staff.name
        })]
      }) : null, /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("booking.form.summaryDate")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700 capitalize",
        children: niceDate
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("booking.form.summaryTime")
      }), /* @__PURE__ */ jsxs("dd", {
        className: "text-right font-semibold text-ink-700",
        children: [reqs.startTime, " – ", endTime]
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("booking.form.summaryDuration")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700",
        children: t("booking.form.durationValue", {
          minutes: reqs.service.durationMinutes
        })
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("booking.form.summaryPrice")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-semibold text-gold-600",
        children: formatPrice(reqs.service.priceAmount, reqs.service.currency)
      })]
    }), /* @__PURE__ */ jsxs(Form, {
      method: "post",
      className: "flex flex-col gap-3",
      children: [/* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "slug",
        value: slug
      }), /* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "serviceId",
        value: reqs.service.id
      }), /* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "staffId",
        value: reqs.staff.id
      }), /* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "date",
        value: reqs.date
      }), /* @__PURE__ */ jsx("input", {
        type: "hidden",
        name: "startTime",
        value: reqs.startTime
      }), /* @__PURE__ */ jsxs("label", {
        className: "flex flex-col gap-1",
        children: [/* @__PURE__ */ jsx("span", {
          className: "text-sm font-medium text-ink-500",
          children: t("booking.form.nameLabel")
        }), /* @__PURE__ */ jsx("input", {
          name: "clientName",
          type: "text",
          required: true,
          autoComplete: "name",
          placeholder: t("booking.form.namePlaceholder"),
          className: "h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
        })]
      }), /* @__PURE__ */ jsxs("label", {
        className: "flex flex-col gap-1",
        children: [/* @__PURE__ */ jsx("span", {
          className: "text-sm font-medium text-ink-500",
          children: t("booking.form.phoneLabel")
        }), /* @__PURE__ */ jsx("input", {
          name: "clientPhone",
          type: "tel",
          required: true,
          inputMode: "tel",
          autoComplete: "tel",
          placeholder: t("booking.form.phonePlaceholder"),
          className: "h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
        })]
      }), /* @__PURE__ */ jsxs("label", {
        className: "flex flex-col gap-1",
        children: [/* @__PURE__ */ jsx("span", {
          className: "text-sm font-medium text-ink-500",
          children: t("booking.form.emailLabel")
        }), /* @__PURE__ */ jsx("input", {
          name: "clientEmail",
          type: "email",
          inputMode: "email",
          autoComplete: "email",
          placeholder: t("booking.form.emailPlaceholder"),
          className: "h-11 rounded-xl border border-cream-300 bg-cream-50 px-3 text-base outline-none focus:border-gold-500"
        })]
      }), /* @__PURE__ */ jsxs("label", {
        className: "flex flex-col gap-1",
        children: [/* @__PURE__ */ jsx("span", {
          className: "text-sm font-medium text-ink-500",
          children: t("booking.form.notesLabel")
        }), /* @__PURE__ */ jsx("textarea", {
          name: "notes",
          rows: 3,
          placeholder: t("booking.form.notesPlaceholder"),
          className: "resize-none rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-base outline-none focus:border-gold-500"
        })]
      }), errKey ? /* @__PURE__ */ jsx("p", {
        className: "rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 text-center text-sm text-danger-500",
        children: t(errKey)
      }) : null, /* @__PURE__ */ jsx("button", {
        type: "submit",
        disabled: submitting,
        className: "mt-2 h-12 rounded-xl bg-gold-500 text-base font-semibold text-cream-50 transition-colors hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-60",
        children: submitting ? t("booking.form.submitting") : t("booking.form.submit")
      })]
    })]
  });
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: b_$slug,
  loader: loader$1,
  meta: meta$2
}, Symbol.toStringTag, { value: "Module" }));
const loader = async ({
  params,
  request
}) => {
  const {
    slug,
    publicId
  } = params;
  if (!slug || !publicId) throw data("Missing params", {
    status: 404
  });
  try {
    const booking2 = await fetchPublicBooking(publicId, request);
    if (booking2.tenant.slug !== slug) {
      throw data("Booking does not match this business", {
        status: 404
      });
    }
    return {
      booking: booking2,
      slug
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw data("Booking not found", {
        status: 404
      });
    }
    throw err;
  }
};
const meta$1 = ({
  data: d
}) => {
  if (!d) return [{
    title: "Bookla"
  }];
  return [{
    title: `${d.booking.tenant.name} — Bookla`
  }];
};
const b_$slug_confirmation_$publicId = UNSAFE_withComponentProps(function ConfirmationRoute() {
  const {
    booking: booking2,
    slug
  } = useLoaderData();
  const t = useT();
  const {
    locale
  } = useI18n();
  const dateFmt = new Intl.DateTimeFormat(locale === "az" ? "az-AZ" : locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const niceDate = dateFmt.format(/* @__PURE__ */ new Date(`${booking2.booking.date}T12:00:00`));
  return /* @__PURE__ */ jsxs(PageShell, {
    children: [/* @__PURE__ */ jsx(BusinessHeader, {
      tenant: booking2.tenant
    }), /* @__PURE__ */ jsxs("section", {
      "aria-live": "polite",
      className: "flex flex-col items-center gap-2 rounded-2xl border border-success-500/30 bg-success-500/5 p-6 text-center",
      children: [/* @__PURE__ */ jsx("div", {
        className: "flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-2xl text-cream-50",
        children: "✓"
      }), /* @__PURE__ */ jsx("h2", {
        className: "text-xl font-semibold text-ink-700",
        children: t("confirmation.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "text-sm text-ink-400",
        children: t("confirmation.subtitle")
      })]
    }), /* @__PURE__ */ jsxs("dl", {
      className: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-cream-300 bg-cream-50 p-4 text-sm",
      children: [/* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.business")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700",
        children: booking2.tenant.name
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.service")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700",
        children: booking2.service.name
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.staff")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700",
        children: booking2.staff.name
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.date")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-medium text-ink-700 capitalize",
        children: niceDate
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.time")
      }), /* @__PURE__ */ jsxs("dd", {
        className: "text-right font-semibold text-ink-700",
        children: [booking2.booking.startTime, " – ", booking2.booking.endTime]
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.duration")
      }), /* @__PURE__ */ jsxs("dd", {
        className: "text-right font-medium text-ink-700",
        children: [booking2.service.durationMinutes, " ", durationUnit(locale)]
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.price")
      }), /* @__PURE__ */ jsx("dd", {
        className: "text-right font-semibold text-gold-600",
        children: formatPrice(booking2.service.priceAmount, booking2.service.currency)
      }), /* @__PURE__ */ jsx("dt", {
        className: "text-ink-400",
        children: t("confirmation.labels.client")
      }), /* @__PURE__ */ jsxs("dd", {
        className: "text-right font-medium text-ink-700",
        children: [booking2.client.name, /* @__PURE__ */ jsx("span", {
          className: "block text-xs text-ink-400",
          children: booking2.client.phone
        }), booking2.client.email ? /* @__PURE__ */ jsx("span", {
          className: "block text-xs text-ink-400",
          children: booking2.client.email
        }) : null]
      }), booking2.booking.notes ? /* @__PURE__ */ jsxs(Fragment, {
        children: [/* @__PURE__ */ jsx("dt", {
          className: "text-ink-400",
          children: t("confirmation.labels.notes")
        }), /* @__PURE__ */ jsx("dd", {
          className: "text-right text-ink-700",
          children: booking2.booking.notes
        })]
      }) : null]
    }), /* @__PURE__ */ jsx(Link, {
      to: `/b/${encodeURIComponent(slug)}`,
      className: "mt-2 flex h-12 items-center justify-center rounded-xl border border-cream-300 text-base font-medium text-ink-700 hover:bg-cream-100",
      children: t("confirmation.newBookingAction")
    })]
  });
});
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: b_$slug_confirmation_$publicId,
  loader,
  meta: meta$1
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => [{
  title: "Bookla"
}];
const _index = UNSAFE_withComponentProps(function LandingRoute() {
  const t = useT();
  return /* @__PURE__ */ jsx(PageShell, {
    children: /* @__PURE__ */ jsxs("section", {
      className: "flex flex-1 flex-col items-center justify-center gap-3 text-center",
      children: [/* @__PURE__ */ jsx("p", {
        className: "text-sm font-semibold uppercase tracking-widest text-gold-600",
        children: t("common.appName")
      }), /* @__PURE__ */ jsx("h1", {
        className: "text-2xl font-semibold text-ink-700",
        children: t("landing.title")
      }), /* @__PURE__ */ jsx("p", {
        className: "max-w-sm text-sm text-ink-400",
        children: t("landing.description")
      })]
    })
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _index,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BLDa_sNd.js", "imports": ["/assets/chunk-4N6VE7H7-Dvo6L692.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": true, "module": "/assets/root-kOqmNenl.js", "imports": ["/assets/chunk-4N6VE7H7-Dvo6L692.js", "/assets/context-8RstgYXK.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/b.$slug": { "id": "routes/b.$slug", "parentId": "root", "path": "b/:slug", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/b._slug-D7b6YbVb.js", "imports": ["/assets/chunk-4N6VE7H7-Dvo6L692.js", "/assets/BusinessHeader-CNaO3koW.js", "/assets/context-8RstgYXK.js", "/assets/PageShell-S9CtCEX6.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/b.$slug.confirmation.$publicId": { "id": "routes/b.$slug.confirmation.$publicId", "parentId": "routes/b.$slug", "path": "confirmation/:publicId", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/b._slug.confirmation._publicId-3PtXxzED.js", "imports": ["/assets/chunk-4N6VE7H7-Dvo6L692.js", "/assets/BusinessHeader-CNaO3koW.js", "/assets/PageShell-S9CtCEX6.js", "/assets/context-8RstgYXK.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasDefaultExport": true, "hasErrorBoundary": false, "module": "/assets/_index-DoszxyOy.js", "imports": ["/assets/chunk-4N6VE7H7-Dvo6L692.js", "/assets/PageShell-S9CtCEX6.js", "/assets/context-8RstgYXK.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-57a7f013.js", "version": "57a7f013", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "v8_passThroughRequests": false, "unstable_trailingSlashAwareDataRequests": false, "unstable_previewServerPrerendering": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/b.$slug": {
    id: "routes/b.$slug",
    parentId: "root",
    path: "b/:slug",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/b.$slug.confirmation.$publicId": {
    id: "routes/b.$slug.confirmation.$publicId",
    parentId: "routes/b.$slug",
    path: "confirmation/:publicId",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route3
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
