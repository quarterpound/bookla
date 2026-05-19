import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createService } from '../../api/services';
import { AppShell, Button, Input } from '../../components/ui';
import { ClientError } from '../../api/base';
import { aznStringToQepik } from '../../lib/money';

export const ServicesNewPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [priceAzn, setPriceAzn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const priceQepik = aznStringToQepik(priceAzn);
  const valid =
    name.trim().length > 0 &&
    durationMinutes >= 5 &&
    Number.isFinite(priceQepik) &&
    priceQepik >= 0;

  const mutation = useMutation({
    mutationFn: () =>
      createService({
        name: name.trim(),
        durationMinutes,
        priceAmount: priceQepik,
      }),
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
    mutation.mutate();
  };

  return (
    <AppShell title={t('services.newTitle')} back hideTabs>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          autoFocus
          label={t('services.fields.name')}
          placeholder={t('services.fields.namePlaceholder')}
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

        {error && (
          <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={!valid || mutation.isPending}
          loading={mutation.isPending}
        >
          {mutation.isPending ? t('services.saving') : t('services.save')}
        </Button>
      </form>
    </AppShell>
  );
};
