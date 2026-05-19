import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendOtp, verifyOtp } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { ClientError } from '../api/base';
import { Button, Input, LocaleSwitcher, LogoMark } from '../components/ui';

export const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendOtp({ phone });
      setStep('code');
    } catch (err) {
      setError(err instanceof ClientError ? err.message : t('auth.errors.sendFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyOtp({ phone, code });
      setAuth(result);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ClientError ? err.message : t('auth.errors.invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-(--container-app) min-h-dvh flex-col bg-cream-50 px-5 pt-safe">
      <div className="flex items-center justify-between pt-6">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <LogoMark width={28} height={28} className="text-gold-500" aria-hidden />
          <span className="text-lg font-semibold tracking-tight">{t('common.appName')}</span>
        </span>
        <LocaleSwitcher />
      </div>

      <div className="flex-1 flex flex-col justify-center py-10">
        {step === 'phone' ? (
          <form onSubmit={onSendOtp} className="flex flex-col gap-5">
            <header className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-ink-700">{t('auth.signInTitle')}</h1>
              <p className="text-sm text-ink-400">{t('auth.signInSubtitle')}</p>
            </header>
            {error && (
              <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
                {error}
              </div>
            )}
            <Input
              label={t('auth.phoneLabel')}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
              {submitting ? t('auth.sending') : t('auth.sendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="flex flex-col gap-5">
            <header className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-ink-700">{t('auth.codeTitle')}</h1>
              <p className="text-sm text-ink-400">{t('auth.sentTo', { phone })}</p>
            </header>
            {error && (
              <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
                {error}
              </div>
            )}
            <Input
              label={t('auth.codeLabel')}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-xl tracking-[0.5em]"
            />
            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
              {submitting ? t('auth.verifying') : t('auth.verify')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              {t('auth.changePhone')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
