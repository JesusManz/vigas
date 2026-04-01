import Stripe from 'stripe';
import products from '../data/products.json' assert { type: 'json' };
import shippingRates from '../data/shipping.json' assert { type: 'json' };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* Determina el peso más caro del carrito */
const WEIGHT_PRIORITY = ['ligero', 'pesado'];

function resolveWeightType(items) {
  let selected = 'ligero';
  for (const item of items) {
    const product = products[item.id];
    if (!product) throw new Error(`Producto inválido: ${item.id}`);
    if (WEIGHT_PRIORITY.indexOf(product.weight) > WEIGHT_PRIORITY.indexOf(selected)) {
      selected = product.weight;
    }
  }
  return selected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { items } = req.body;

    if (!items || !items.length) throw new Error('Carrito vacío');

    /* Construye line_items seguros desde JSON */
    const line_items = items.map(item => {
      const product = products[item.id];
      return {
        price: product.priceId,
        quantity: item.cantidad,
      };
    });

    /* Determina el peso más caro del carrito */
    const weightType = resolveWeightType(items);

    /* Obtiene todos los shipping rates válidos para ese peso */
    const shipping_options = shippingRates[weightType].map(rate => ({ shipping_rate: rate }));

    /* Crea sesión Checkout */
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      shipping_address_collection: {
        allowed_countries: ['ES','FR','PT','IT','DE','GB']
      },
      shipping_options,
      phone_number_collection: { enabled: true },
      success_url: `${req.headers.origin}/success.html`,
      cancel_url: `${req.headers.origin}/tienda.html`,
    });

    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
