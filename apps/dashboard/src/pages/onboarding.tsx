import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { OnboardingDto } from '@bookla/dto/auth';
import { ClientError } from '../api/base';
import { completeOnboarding } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { AppShell, Button, Input, TimePicker } from '../components/ui';
import { cn } from '../components/ui/cn';

type Step = 'business' | 'slug' | 'service' | 'hours';
const STEPS: Step[] = ['business', 'slug', 'service', 'hours'];

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_KEYS = [
  'onboarding.hours.days.mon',
  'onboarding.hours.days.tue',
  'onboarding.hours.days.wed',
  'onboarding.hours.days.thu',
  'onboarding.hours.days.fri',
  'onboarding.hours.days.sat',
  'onboarding.hours.days.sun',
];

interface DayState {
  enabled: boolean;
}

interface FormState {
  businessName: string;
  slug: string;
  serviceName: string;
  durationMinutes: number;
  priceAzn: string; // free-form so users can type "15" or "15.50"
  workingHours: {
    days: DayState[]; // length 7, index = dayOfWeek (0=Mon)
    startTime: string;
    endTime: string;
  };
}

const initialForm: FormState = {
  businessName: '',
  slug: '',
  serviceName: '',
  durationMinutes: 30,
  priceAzn: '',
  workingHours: {
    days: [
      { enabled: true },
      { enabled: true },
      { enabled: true },
      { enabled: true },
      { enabled: true },
      { enabled: true },
      { enabled: false },
    ],
    startTime: '09:00',
    endTime: '19:00',
  },
};

const normalizeSlug = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

const aznToQepik = (azn: string): number => {
  const cleaned = azn.replace(',', '.').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (Number.isNaN(n)) return Number.NaN;
  return Math.round(n * 100);
};

export const OnboardingPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('business');
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const businessValid = form.businessName.trim().length >= 2;
  const slugValid = SLUG_REGEX.test(form.slug) && form.slug.length >= 3;
  const priceQepik = aznToQepik(form.priceAzn);
  const serviceValid =
    form.serviceName.trim().length > 0 &&
    form.durationMinutes >= 5 &&
    form.durationMinutes <= 8 * 60 &&
    Number.isFinite(priceQepik) &&
    priceQepik >= 0;
  const hoursValid = form.workingHours.days.some((d) => d.enabled) && form.workingHours.startTime < form.workingHours.endTime;

  const advance = (next: Step) => {
    setServerError(null);
    setSlugError(null);
    setStep(next);
  };

  const goBack = () => {
    setServerError(null);
    if (stepIndex === 0) return;
    setStep(STEPS[stepIndex - 1]!);
  };

  const submit = async () => {
    setSubmitting(true);
    setServerError(null);
    setSlugError(null);
    try {
      const workingHours = form.workingHours.days
        .map((d, dayOfWeek) =>
          d.enabled
            ? {
                dayOfWeek,
                startTime: form.workingHours.startTime,
                endTime: form.workingHours.endTime,
              }
            : null,
        )
        .filter((x): x is OnboardingDto['workingHours'][number] => x !== null);

      const dto: OnboardingDto = {
        businessName: form.businessName.trim(),
        slug: form.slug,
        firstService: {
          name: form.serviceName.trim(),
          durationMinutes: form.durationMinutes,
          priceAmount: priceQepik,
        },
        workingHours,
      };

      const result = await completeOnboarding(dto);
      setAuth(result);
      navigate('/', { replace: true });
    } catch (err) {
      const code = (err instanceof ClientError && (err.apiError as { code?: string } | undefined)?.code) || null;
      if (code === 'SLUG_TAKEN') {
        setSlugError(t('onboarding.slug.errors.taken'));
        setStep('slug');
      } else {
        setServerError(err instanceof ClientError ? err.message : t('onboarding.errors.submit'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title={t('onboarding.title')}
      hideTabs
      back={stepIndex > 0}
      onBack={goBack}
    >
      <ProgressBar value={(stepIndex + 1) / STEPS.length} />

      <div className="mt-6 flex flex-col gap-6">
        {step === 'business' && (
          <BusinessStep
            value={form.businessName}
            onChange={(v) => setForm({ ...form, businessName: v })}
            onSubmit={() => businessValid && advance('slug')}
            valid={businessValid}
          />
        )}

        {step === 'slug' && (
          <SlugStep
            businessName={form.businessName}
            value={form.slug}
            onChange={(v) => setForm({ ...form, slug: normalizeSlug(v) })}
            onSubmit={() => slugValid && advance('service')}
            valid={slugValid}
            error={slugError}
          />
        )}

        {step === 'service' && (
          <ServiceStep
            name={form.serviceName}
            durationMinutes={form.durationMinutes}
            priceAzn={form.priceAzn}
            onChange={(patch) => setForm({ ...form, ...patch })}
            onSubmit={() => serviceValid && advance('hours')}
            valid={serviceValid}
          />
        )}

        {step === 'hours' && (
          <HoursStep
            state={form.workingHours}
            onChange={(workingHours) => setForm({ ...form, workingHours })}
            onSubmit={submit}
            valid={hoursValid && !submitting}
            submitting={submitting}
            error={serverError}
          />
        )}
      </div>
    </AppShell>
  );
};

/* ---------------------------------------------------------------------------
   Step components
--------------------------------------------------------------------------- */

const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <header className="flex flex-col gap-1">
    <h2 className="text-2xl font-semibold text-ink-700">{title}</h2>
    {subtitle && <p className="text-sm text-ink-400">{subtitle}</p>}
  </header>
);

const BusinessStep = ({
  value,
  onChange,
  onSubmit,
  valid,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  valid: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <StepHeader
        title={t('onboarding.business.title')}
        subtitle={t('onboarding.business.subtitle')}
      />
      <Input
        autoFocus
        label={t('onboarding.business.label')}
        placeholder={t('onboarding.business.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        required
      />
      <Button type="submit" size="lg" fullWidth disabled={!valid}>
        {t('onboarding.next')}
      </Button>
    </form>
  );
};

const SlugStep = ({
  businessName,
  value,
  onChange,
  onSubmit,
  valid,
  error,
}: {
  businessName: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  valid: boolean;
  error: string | null;
}) => {
  const { t } = useTranslation();
  // Suggest a slug derived from the business name on first reveal.
  const suggestion = useMemo(() => normalizeSlug(businessName), [businessName]);
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <StepHeader
        title={t('onboarding.slug.title')}
        subtitle={t('onboarding.slug.subtitle')}
      />
      <Input
        autoFocus
        label={t('onboarding.slug.label')}
        placeholder={suggestion || t('onboarding.slug.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        hint={value ? `bookla.app/b/${value}` : t('onboarding.slug.hint')}
        error={error ?? undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        maxLength={50}
        required
      />
      {suggestion && suggestion !== value && (
        <button
          type="button"
          onClick={() => onChange(suggestion)}
          className="self-start text-sm font-medium text-gold-700 underline-offset-2 hover:underline"
        >
          {t('onboarding.slug.useSuggestion', { suggestion })}
        </button>
      )}
      <Button type="submit" size="lg" fullWidth disabled={!valid}>
        {t('onboarding.next')}
      </Button>
    </form>
  );
};

const ServiceStep = ({
  name,
  durationMinutes,
  priceAzn,
  onChange,
  onSubmit,
  valid,
}: {
  name: string;
  durationMinutes: number;
  priceAzn: string;
  onChange: (patch: Partial<Pick<FormState, 'serviceName' | 'durationMinutes' | 'priceAzn'>>) => void;
  onSubmit: () => void;
  valid: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <StepHeader
        title={t('onboarding.service.title')}
        subtitle={t('onboarding.service.subtitle')}
      />
      <Input
        autoFocus
        label={t('onboarding.service.nameLabel')}
        placeholder={t('onboarding.service.namePlaceholder')}
        value={name}
        onChange={(e) => onChange({ serviceName: e.target.value })}
        maxLength={80}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('onboarding.service.durationLabel')}
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          step={5}
          value={durationMinutes}
          onChange={(e) => onChange({ durationMinutes: Number(e.target.value) || 0 })}
          hint={t('onboarding.service.durationHint')}
          required
        />
        <Input
          label={t('onboarding.service.priceLabel')}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={priceAzn}
          onChange={(e) => onChange({ priceAzn: e.target.value.replace(/[^0-9.,]/g, '') })}
          hint={t('onboarding.service.priceHint')}
        />
      </div>
      <Button type="submit" size="lg" fullWidth disabled={!valid}>
        {t('onboarding.next')}
      </Button>
    </form>
  );
};

const HoursStep = ({
  state,
  onChange,
  onSubmit,
  valid,
  submitting,
  error,
}: {
  state: FormState['workingHours'];
  onChange: (next: FormState['workingHours']) => void;
  onSubmit: () => void;
  valid: boolean;
  submitting: boolean;
  error: string | null;
}) => {
  const { t } = useTranslation();
  const toggleDay = (idx: number) => {
    const days = state.days.map((d, i) => (i === idx ? { enabled: !d.enabled } : d));
    onChange({ ...state, days });
  };
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <StepHeader
        title={t('onboarding.hours.title')}
        subtitle={t('onboarding.hours.subtitle')}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-600">{t('onboarding.hours.daysLabel')}</span>
        <div className="grid grid-cols-7 gap-1.5">
          {state.days.map((d, idx) => (
            <button
              key={idx}
              type="button"
              aria-pressed={d.enabled}
              onClick={() => toggleDay(idx)}
              className={cn(
                'h-11 rounded-xl border text-sm font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                d.enabled
                  ? 'bg-gold-500 text-cream-50 border-gold-500'
                  : 'bg-cream-100 text-ink-400 border-cream-300 hover:bg-cream-200',
              )}
            >
              {t(DAY_KEYS[idx]!)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimePicker
          label={t('onboarding.hours.openLabel')}
          ariaLabel={t('onboarding.hours.openLabel')}
          value={state.startTime}
          onChange={(v) => onChange({ ...state, startTime: v })}
        />
        <TimePicker
          label={t('onboarding.hours.closeLabel')}
          ariaLabel={t('onboarding.hours.closeLabel')}
          value={state.endTime}
          onChange={(v) => onChange({ ...state, endTime: v })}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" fullWidth disabled={!valid} loading={submitting}>
        {submitting ? t('onboarding.submitting') : t('onboarding.finish')}
      </Button>
    </form>
  );
};

/* ---------------------------------------------------------------------------
   Tiny progress indicator across the four steps.
--------------------------------------------------------------------------- */
const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-1 rounded-full bg-cream-200 overflow-hidden" aria-hidden>
    <div
      className="h-full bg-gold-500 transition-[width] duration-200"
      style={{ width: `${Math.round(value * 100)}%` }}
    />
  </div>
);

