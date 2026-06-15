const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const amount = intent.amount;
    const orderId = intent.id.slice(-8).toUpperCase();
    const metadata = intent.metadata || {};
    const items = (() => { try { return JSON.parse(metadata.items || '[]'); } catch { return []; } })();
    const shipping = intent.shipping || {};
    const name = shipping.name || metadata.customer_name || 'Customer';
    const email = intent.receipt_email || metadata.customer_email || '';
    const address = shipping.address || {};

    const itemsText = items.length > 0
      ? items.map(i => ((i.id || 'ITEM').toUpperCase() + ' × ' + i.qty)).join('\n')
      : 'STRATA × 1';

    const addressText = [
      address.line1 || metadata.customer_address,
      address.city,
      address.postal_code,
      address.country
    ].filter(Boolean).join(', ');

    const shippingCountry = address.country || metadata.customer_address?.slice(-2) || 'JP';
    const shippingFee = shippingCountry === 'JP' ? 0 : 3500;
    const productAmount = amount - shippingFee;
    const formattedAmount = '¥' + Number(amount).toLocaleString();
    const formattedShipping = shippingFee === 0 ? 'Free' : '¥' + shippingFee.toLocaleString();

    // Seller notification
    await sendEmail({
      to: 'beton.kyoto@proton.me',
      subject: 'NEW ORDER #' + orderId + ' — ' + formattedAmount,
      html: '<div style="background:#000;color:#f5f0e8;font-family:sans-serif;padding:40px;max-width:560px;">'
        + '<div style="font-size:22px;letter-spacing:6px;margin-bottom:32px;">BE/TON</div>'
        + '<div style="font-size:11px;letter-spacing:4px;color:#888;margin-bottom:8px;">NEW ORDER</div>'
        + '<div style="font-size:28px;letter-spacing:2px;margin-bottom:32px;">#' + orderId + '</div>'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr style="border-bottom:0.5px solid #1a1a1a;"><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">ITEMS</td><td style="padding:12px 0;color:#f5f0e8;font-size:12px;text-align:right;">' + itemsText.replace(/\n/g, '<br>') + '</td></tr>'
        + '<tr style="border-bottom:0.5px solid #1a1a1a;"><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">AMOUNT</td><td style="padding:12px 0;color:#E34234;font-size:16px;text-align:right;">' + formattedAmount + '</td></tr>'
        + '<tr style="border-bottom:0.5px solid #1a1a1a;"><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">CUSTOMER</td><td style="padding:12px 0;color:#f5f0e8;font-size:12px;text-align:right;">' + name + '<br>' + email + '</td></tr>'
        + '<tr><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">SHIP TO</td><td style="padding:12px 0;color:#f5f0e8;font-size:12px;text-align:right;">' + (addressText || '—') + '</td></tr>'
        + '</table>'
        + '<div style="margin-top:32px;padding-top:24px;border-top:0.5px solid #1a1a1a;font-size:11px;color:#555;letter-spacing:2px;">KYOTO, JAPAN — 京都</div>'
        + '</div>'
    });

    // Customer confirmation
    if (email) {
      await sendEmail({
        to: email,
        subject: 'Order confirmed — #' + orderId,
        html: '<div style="background:#000;color:#f5f0e8;font-family:sans-serif;padding:40px;max-width:560px;">'
          + '<div style="font-size:22px;letter-spacing:6px;margin-bottom:32px;">BE/TON</div>'
          + '<div style="font-size:11px;letter-spacing:4px;color:#888;margin-bottom:8px;">ORDER CONFIRMED</div>'
          + '<div style="font-size:28px;letter-spacing:2px;margin-bottom:32px;">#' + orderId + '</div>'
          + '<table style="width:100%;border-collapse:collapse;">'
          + '<tr style="border-bottom:0.5px solid #1a1a1a;"><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">ITEMS</td><td style="padding:12px 0;color:#f5f0e8;font-size:12px;text-align:right;">' + itemsText.replace(/\n/g, '<br>') + '</td></tr>'
          + '<tr style="border-bottom:0.5px solid #1a1a1a;"><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">AMOUNT</td><td style="padding:12px 0;color:#E34234;font-size:16px;text-align:right;">' + formattedAmount + '</td></tr>'
          + '<tr><td style="padding:12px 0;color:#888;font-size:12px;letter-spacing:2px;">SHIP TO</td><td style="padding:12px 0;color:#f5f0e8;font-size:12px;text-align:right;">' + (addressText || '—') + '</td></tr>'
          + '</table>'
          + '<div style="margin-top:32px;padding-top:24px;border-top:0.5px solid #1a1a1a;font-size:11px;color:#555;letter-spacing:2px;line-height:2;">Handcast in Kyoto. Ships within 3–5 business days.<br>betonkyoto.com</div>'
          + '</div>'
      });
    }
  }

  res.status(200).json({ received: true });
};

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) { console.error('RESEND_API_KEY not set'); return; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'BE/TON <orders@betonkyoto.com>', to, subject, html })
    });
    const data = await res.json();
    if (!res.ok) console.error('Resend error:', JSON.stringify(data));
  } catch (err) { console.error('Email send error:', err); }
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports.config = { api: { bodyParser: false } };
