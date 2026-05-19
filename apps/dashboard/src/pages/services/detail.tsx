import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deactivateService, getService, updateService } from '../../api/services';
import { AppShell, Button, Input, Skeleton } from '../../components/ui';
import { ClientError } from '../../api/base';
import { aznStringToQepik, qepikToAznString } from '../../lib/money';

export const ServicesDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const query = useQuery({
    queryKey: ['services', id],
    queryFn: () => getService(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priceAzn, setPriceAzn] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setName(query.data.name);
    setDurationMinutes(query.data.durationMinutes);
    setPriceAzn(qepikToAznString(query.data.priceAmount));
    setIsActive(query.data.isActive);
  }, [query.data]);

  const priceQepik = aznStringToQepik(priceAzn);
  const valid =
    name.trim().length > 0 &&
    durationMinutes >= 5 &&
    Number.isFinite(priceQepik) &&
    priceQepik >= 0;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateService(id, {
        name: name.trim(),
        durationMinutes,
        priceAmount: priceQepik,
        isActive,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['services', id], updated);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigate('/services', { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('services.errors.saveFailed'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigate('/services', { replace: true });
    },
    onError: (err) => {
      setError(err instanceof ClientError ? err.message : t('services.errors.saveFailed'));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!valid) return;
    saveMutation.mutate();
  };

  return (
    <AppShell title={t('services.editTitle')} back hideTabs>
      {query.isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {query.isError && (
        <p className="text-sm text-danger-500">{t('services.errors.loadFailed')}</p>
      )}

      {query.data && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Input
            label={t('services.fields.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('services.fields.duration')}
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
              hint={t('services.fields.durationHint')}
              required
            />
            <Input
              label={t('services.fields.price')}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={priceAzn}
              onChange={(e) => setPriceAzn(e.target.value.replace(/[^0-9.,]/g, ''))}
              hint={t('services.fields.priceHint')}
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-cream-200 bg-cream-100 px-4 py-3">
            <span className="flex flex-col">
              <span className="font-medium text-ink-700">
                {t('services.activeToggle.label')}
              </span>
              <span className="text-sm text-ink-400">
                {t('services.activeToggle.hint')}
              </span>
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 accent-gold-500"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={!valid || saveMutation.isPending}
            loading={saveMutation.isPending}
          >
            {saveMutation.isPending ? t('services.saving') : t('services.save')}
          </Button>

          {isActive && (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
              className="text-danger-500 hover:bg-danger-500/10"
            >
              {deactivateMutation.isPending ? t('services.deactivating') : t('services.deactivate')}
            </Button>
          )}
        </form>
      )}
    </AppShell>
  );
};
