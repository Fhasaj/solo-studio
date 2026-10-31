/*
 * @name: Currency
 * @description: The currency every amount is shown and charged in: GBP for UK freelancers, EUR for Ireland.
 * Set at build time with NEXT_PUBLIC_CURRENCY so the browser and server always agree.
 * */

export const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY === 'EUR' ? 'EUR' : 'GBP') as 'GBP' | 'EUR';
export const CURRENCY_SYMBOL = CURRENCY === 'EUR' ? '€' : '£';
// Stripe wants lower case
export const STRIPE_CURRENCY = CURRENCY.toLowerCase();
