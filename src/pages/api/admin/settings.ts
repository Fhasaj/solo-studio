import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/requireAdmin';
import { GetSiteSettings, SaveSiteSettings } from '@/lib/query/settings.query';
import { SETTING_FIELDS, parseHours, type SettingField, type SettingKey } from '@/lib/siteSettings';
import { readDate, readEmail, readEnum, readInt, readText, readUrl, sendApiError, ValidationError } from '@/lib/validate';

function readSetting(field: SettingField, value: unknown) {
  const { key, label } = field;
  switch (field.type) {
    case 'number':
      return String(readInt(value, key, { label, min: field.min ?? 0, max: field.max ?? 1_000_000 }));
    case 'email':
      return readEmail(value, key, { label, required: false });
    case 'url':
      return readUrl(value, key, { label });
    case 'select':
      return readEnum(value, key, (field.options ?? []).map(([option]) => option), label);
    case 'date':
      return readDate(value, key, { label });
    case 'hours': {
      const text = readText(value, key, { label, max: 200 });
      try {
        return parseHours(text).map((range) => `${range.start}-${range.end}`).join(', ');
      } catch (err) {
        throw new ValidationError(key, `${label}: ${(err as Error).message}`);
      }
    }
    case 'dates': {
      const lines = readText(value, key, { label, max: 5000, multiline: true }).split('\n').map((line) => line.trim()).filter(Boolean);
      return lines.map((line) => readDate(line, key, { label })).join('\n');
    }
    default: {
      const text = readText(value, key, { label, max: field.maxLength ?? 200, multiline: field.type === 'textarea' });
      if (field.pattern && !field.pattern.regex.test(text)) throw new ValidationError(key, field.pattern.message);
      return text;
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') return res.status(200).json({ ok: true, data: GetSiteSettings() });
  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const input = req.body?.values;
    if (!input || typeof input !== 'object') throw new ValidationError('values', 'Nothing to save');

    // Only the fields sent are changed, so each settings group can be saved on its own
    const values: Partial<Record<SettingKey, string>> = {};
    for (const field of SETTING_FIELDS as readonly SettingField[]) {
      if (field.key in input) values[field.key as SettingKey] = readSetting(field, input[field.key]);
    }
    SaveSiteSettings(values);
    return res.status(200).json({ ok: true, data: GetSiteSettings() });
  } catch (err) {
    return sendApiError(res, err);
  }
}
