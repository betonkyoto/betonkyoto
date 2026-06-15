import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCT_PRICE = 26000;
const INTL_SHIPPING = 3500;
const MAX_QTY = 10; // per product line item
const MAX_TOTAL_QTY = 10; // absolute max across all items

// Simple in-memory rate limiter
const ipCalls = new Map();
const RATE_LIMIT = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  const timestamps = (ipCalls.get(ip) || []).filter(t => t > windowStart);
  timestamps.push(now);
  ipCalls.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

function isValidAmount(amount, items) {
  if (!amount || amount < PRODUCT_PRICE) return false;

  // No items array — accept single unit price with or without shipping
  if (!items || !Array.isArray(items) || items.length === 0) {
    return amount === PRODUCT_PRICE || amount === PRODUCT_PRICE + INTL_SHIPPING;
  }

  // Validate each item
  const totalQty = items.reduce((sum, i) => sum + (parseInt(i.qty) || 1), 0);

  // Reject if total qty exceeds hard cap
  if (totalQty < 1 || totalQty > MAX_TOTAL_QTY) return false;

  // Reject if any single line item exceeds per-product cap
  for (const item of items) {
    if ((parseInt(item.qty) || 1) > MAX_QTY) return false;
  }

  // Calculate expected subtotal
  const expectedSubtotal = items.reduce((sum, i) => {
    const qty = parseInt(i.qty) || 1;
    if (i.id === 'strata') return sum + (PRODUCT_PRICE * qty);
    return sum; // unknown product — reject below
  }, 0);

  // Reject if no recognised products
  if (expectedSubtotal === 0) return false;

  // Valid amounts: subtotal (JP free shipping) or subtotal + international shipping
  return amount === expectedSubtotal || amount === expectedSubtotal + INTL_SHIPPING;
}

// Allowed origins — add localhost for dev
const ALLOWED_ORIGINS = [
  'https://betonkyoto.com',
  'https://www.betonkyoto.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF: validate Origin header
  const origin = req.headers['origin'] || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { amount, items, customer, intentId } = req.body;

    // Update existing intent
    if (intentId) {
      const updateData = {};

      if (amount) {
        if (!isValidAmount(amount, items)) {
          return res.status(400).json({ error: 'Invalid amount' });
        }
        updateData.amount = amount;
      }

      if (customer) {
        updateData.receipt_email = customer.email || undefined;
        updateData.shipping = {
          name: customer.name || '',
          address: {
            line1: customer.address || '',
            city: customer.city || '',
            postal_code: customer.postal || '',
            country: customer.country || 'JP'
          }
        };
        updateData.metadata = {
          customer_name:    customer.name || '',
          customer_email:   customer.email || '',
          customer_address: `${customer.address}, ${customer.city}, ${customer.postal}, ${customer.country}`
        };
      }

      await stripe.paymentIntents.update(intentId, updateData);
      return res.status(200).json({ updated: true });
    }

    // Create new intent
    if (!isValidAmount(amount, items)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'jpy',
      automatic_payment_methods: { enabled: true },
      metadata: {
        items: JSON.stringify(items || []),
        brand: 'BE/TON Kyoto'
      }
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}
