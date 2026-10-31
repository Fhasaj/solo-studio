/*
 * @name: Stripe
 * @description: Card payments through Stripe Checkout. Only used when STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set.
 * Card details never touch this site: clients pay on Stripe's own page.
 * */

import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripeReady() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
