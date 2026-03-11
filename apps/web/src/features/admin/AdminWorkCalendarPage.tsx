import { useEffect, useMemo, useState, type SelectHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import {
  getAdminUsers,
  getAssignedJobsForUser,
  type AssignedUserJob,
  type AdminUser
} from "./settings-client";

const WORK_HOUR_SLOTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export function AdminWorkCalendarPage() {
  const { locale } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [jobs, setJobs] = useState<AssignedUserJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calendarUsers = users.filter(
    (user) => user.isActive && user.role === "EMPLOYEE"
  );
  const selectedUser = calendarUsers.find((user) => user.id === selectedUserId) ?? null;
  const calendarDays = buildCalendarDays(calendarMonth);
  const selectedDayJobs = jobs
    .filter((job) => isSameDay(job.scheduledStartAt, selectedDate))
    .sort((a, b) => getDateValue(a.scheduledStartAt) - getDateValue(b.scheduledStartAt));

  const jobsByHour = useMemo(() => {
    const map = new Map<number, AssignedUserJob[]>();
    for (const hour of WORK_HOUR_SLOTS) {
      map.set(hour, []);
    }

    for (const job of selectedDayJobs) {
      const jobDate = job.scheduledStartAt ? new Date(job.scheduledStartAt) : null;
      if (!jobDate) continue;
      const hour = jobDate.getHours();
      const targetHour = WORK_HOUR_SLOTS.includes(hour) ? hour : 8;
      map.get(targetHour)?.push(job);
    }

    return map;
  }, [selectedDayJobs]);

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (calendarUsers.length === 0) {
      setSelectedUserId("");
      return;
    }

    if (!calendarUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(calendarUsers[0].id);
    }
  }, [calendarUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setJobs([]);
      return;
    }

    void loadJobs(selectedUserId, calendarMonth);
  }, [selectedUserId, calendarMonth]);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getAdminUsers();
      setUsers(items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie można załadować użytkowników."
            : "Unable to load users"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadJobs(userId: string, month: Date) {
    setIsLoading(true);
    setError(null);
    try {
      const rangeStart = startOfWeek(startOfMonth(month));
      const rangeEnd = endOfWeek(endOfMonth(month));
      const payload = await getAssignedJobsForUser(
        userId,
        rangeStart.toISOString(),
        rangeEnd.toISOString()
      );
      setJobs(payload.items);

      const firstScheduledJob = payload.items
        .map((job) => (job.scheduledStartAt ? new Date(job.scheduledStartAt) : null))
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => left.getTime() - right.getTime())[0];

      setSelectedDate(firstScheduledJob ? startOfDay(firstScheduledJob) : startOfDay(month));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie można załadować kalendarza pracy."
            : "Unable to load work calendar"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-neutral-900 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
          {locale === "pl" ? "Admin / Kalendarz" : "Admin / Calendar"}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight">
              {locale === "pl" ? "Kalendarz pracy" : "Work Calendar"}
            </h1>
            <p className="max-w-3xl leading-7 text-neutral-800">
              {locale === "pl"
                ? "Przeglądaj przypisane zlecenia w widoku miesięcznym oraz dzienny harmonogram godzin pracy."
                : "Review assigned jobs in a monthly calendar and a daily working-hours agenda."}
            </p>
          </div>
          <Link
            to="/admin"
            className="border border-neutral-900 px-4 py-3 text-xs uppercase tracking-[0.16em]"
          >
            {locale === "pl" ? "Wróć do administracji" : "Back to Admin"}
          </Link>
        </div>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="space-y-5 border border-neutral-900 p-5">
        <header className="space-y-1 border-b border-neutral-900 pb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">
            {locale === "pl" ? "Filtry" : "Filters"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {locale === "pl" ? "Użytkownik i miesiąc" : "User and Month"}
          </h2>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:items-end">
          <SelectField
            label={locale === "pl" ? "Użytkownik" : "User"}
            name="calendarUser"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            options={calendarUsers.map((user) => ({
              value: user.id,
              label: `${user.fullName} (${user.role})`
            }))}
          />
          <div className="grid gap-3 md:grid-cols-[minmax(0,11rem)_minmax(14rem,1fr)_minmax(0,11rem)]">
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
              className="flex h-12 items-center justify-center border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
            >
              {locale === "pl" ? "Poprzedni miesiąc" : "Previous Month"}
            </button>
            <p className="flex h-12 items-center justify-center border border-neutral-900 px-4 text-center text-sm font-medium uppercase tracking-[0.12em] text-neutral-800">
              {formatMonthLabel(calendarMonth, locale)}
            </p>
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="flex h-12 items-center justify-center border border-neutral-900 px-4 text-xs uppercase tracking-[0.16em]"
            >
              {locale === "pl" ? "Następny miesiąc" : "Next Month"}
            </button>
          </div>
        </div>
      </section>

      {!selectedUser ? (
        <section className="border border-neutral-900 p-5">
          <p className="text-sm text-neutral-700">
            {locale === "pl"
              ? "Brak aktywnych użytkowników do wyświetlenia w kalendarzu."
              : "There are no active users available for the calendar."}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
          <section className="space-y-4 border border-neutral-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-neutral-300 px-4 py-3 text-sm">
              <p>
                <span className="font-medium">{locale === "pl" ? "Harmonogram:" : "Schedule:"}</span>{" "}
                {selectedUser.fullName}
              </p>
              <p className="text-neutral-700">
                {isLoading
                  ? locale === "pl"
                    ? "Ładowanie zleceń..."
                    : "Loading jobs..."
                  : locale === "pl"
                    ? `${jobs.length} zleceń w miesiącu`
                    : `${jobs.length} jobs in month`}
              </p>
            </div>

            <div className="grid grid-cols-7 border border-neutral-900 text-xs uppercase tracking-[0.16em] text-neutral-700">
              {getWeekdayLabels(locale).map((label) => (
                <div key={label} className="border-b border-r border-neutral-300 px-3 py-2 last:border-r-0">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 border-x border-b border-neutral-900 md:grid-cols-7">
              {calendarDays.map((day) => {
                const dayJobs = jobs
                  .filter((job) => isSameDay(job.scheduledStartAt, day))
                  .sort((a, b) => getDateValue(a.scheduledStartAt) - getDateValue(b.scheduledStartAt));
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isSelected = isSameCalendarDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(day))}
                    className={`min-h-32 border-r border-t border-neutral-300 p-3 text-left last:border-r-0 ${
                      isSelected
                        ? "bg-neutral-100"
                        : isCurrentMonth
                          ? "bg-paper"
                          : "bg-neutral-100/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${isCurrentMonth ? "text-neutral-900" : "text-neutral-500"}`}>
                        {formatDayNumber(day, locale)}
                      </p>
                    </div>

                    <div className="mt-3">
                      {dayJobs.length === 0 ? (
                        <p className="text-xs leading-5 text-neutral-500">
                          {locale === "pl" ? "Brak zleceń" : "No jobs"}
                        </p>
                      ) : (
                        <p className="text-xs font-medium leading-5 text-neutral-700">
                          {locale === "pl"
                            ? `${dayJobs.length} ${dayJobs.length === 1 ? "zlecenie" : "zlecenia"}`
                            : `${dayJobs.length} ${dayJobs.length === 1 ? "job" : "jobs"}`}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 border border-neutral-900 p-5">
            <header className="space-y-1 border-b border-neutral-900 pb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">
                {locale === "pl" ? "Godziny pracy" : "Working Hours"}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {formatSelectedDayLabel(selectedDate, locale)}
              </h2>
              <p className="text-sm leading-6 text-neutral-800">
                {locale === "pl"
                  ? "Kliknij dzień w kalendarzu, aby zobaczyć harmonogram godzinowy."
                  : "Select a day in the calendar to review the hourly schedule."}
              </p>
            </header>

            <div className="space-y-2">
              {WORK_HOUR_SLOTS.map((hour) => {
                const hourJobs = jobsByHour.get(hour) ?? [];
                return (
                  <div key={hour} className="grid grid-cols-[5rem_1fr] gap-3 border border-neutral-300 p-3">
                    <div className="text-sm font-medium text-neutral-700">
                      {formatHourLabel(hour, locale)}
                    </div>
                    <div className="min-w-0 space-y-2">
                      {hourJobs.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          {locale === "pl" ? "Brak zaplanowanych zadań" : "No scheduled jobs"}
                        </p>
                      ) : (
                        hourJobs.map((job) => (
                          <Link
                            key={job.id}
                            to={`/dashboard?jobId=${encodeURIComponent(job.jobId)}`}
                            className="block w-full min-w-0 overflow-hidden border border-neutral-900 bg-neutral-100 px-3 py-3 transition hover:bg-paper"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5">
                                {job.title}
                              </p>
                              <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-neutral-700">
                                {formatJobTime(job.scheduledStartAt, locale)}
                              </span>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SelectField({
  label,
  name,
  options,
  value,
  onChange
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: SelectHTMLAttributes<HTMLSelectElement>["onChange"];
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-xs uppercase tracking-[0.16em] text-neutral-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="h-12 w-full border border-neutral-900 bg-paper px-3"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildCalendarDays(month: Date) {
  const firstVisibleDay = startOfWeek(startOfMonth(month));
  const lastVisibleDay = endOfWeek(endOfMonth(month));
  const days: Date[] = [];
  const cursor = new Date(firstVisibleDay);

  while (cursor <= lastVisibleDay) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(value: string | null, date: Date) {
  if (!value) return false;
  const target = new Date(value);
  return isSameCalendarDay(target, date);
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getWeekdayLabels(locale: "en" | "pl") {
  const baseDate = startOfWeek(new Date(2026, 0, 5));
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
      weekday: "short"
    }).format(addDays(baseDate, index))
  );
}

function formatMonthLabel(date: Date, locale: "en" | "pl") {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDayNumber(date: Date, locale: "en" | "pl") {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    day: "numeric"
  }).format(date);
}

function formatSelectedDayLabel(date: Date, locale: "en" | "pl") {
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatHourLabel(hour: number, locale: "en" | "pl") {
  const date = new Date(2026, 0, 1, hour);
  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatJobTime(value: string | null, locale: "en" | "pl") {
  if (!value) {
    return locale === "pl" ? "Bez godziny" : "No time";
  }

  return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getDateValue(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return new Date(value).getTime();
}
