import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { ratesFor, taxCountry } from '@/lib/finance';
import { DeleteTaxRateOverride, GetTaxRateOverride, SaveTaxRateOverride } from '@/lib/query/finance.query';
import { BUILT_IN_RATES } from '@/lib/taxRates';
import { readText, sendApiError, ValidationError } from '@/lib/validate';

// The rates used for a tax year, and your corrections to them
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  const country = taxCountry();
  const body = req.body ?? {};
  try {
    const year = readText(req.method === 'GET' ? req.query.year : body.year, 'year', { label: 'Tax year', max: 7, required: true });
    if (!/^\d{4}(\/\d{2})?$/.test(year)) throw new ValidationError('year', 'Use a tax year like 2026/27 (UK) or 2026 (Ireland)');

    if (req.method === 'GET') {
      const { rates, fallback } = ratesFor(country, year);
      return res.status(200).json({ ok: true, data: { rates, fallback, overridden: Boolean(GetTaxRateOverride(country, year)), builtInYears: BUILT_IN_RATES.filter((r) => r.country === country).map((r) => r.year) } });
    }
    if (req.method === 'PUT') {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(readText(body.json, 'json', { label: 'Rates', max: 20_000, required: true, multiline: true }));
      } catch {
        throw new ValidationError('json', "That isn't valid JSON");
      }
      // Must have the same shape as the built-in rates for this country
      const template = BUILT_IN_RATES.find((r) => r.country === country)!;
      const missing = Object.keys(template).filter((key) => !['country', 'year', 'checked', 'sources'].includes(key) && !(key in data));
      if (missing.length) throw new ValidationError('json', `Missing: ${missing.join(', ')}`);
      SaveTaxRateOverride(country, year, { ...data, country, year });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      DeleteTaxRateOverride(country, year);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (err) {
    return sendApiError(res, err);
  }
}
