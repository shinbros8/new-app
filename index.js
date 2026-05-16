const express = require('express');
const axios = require('axios');const app = express();
app.use(express.json());

// I-set up ang credentials (Ito ay dapat ilagay mo rin sa Render Environment Variables)
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || 'ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3';
const PAYPAL_API = 'https://api-m.paypal.com'; // Gamitin ang 'https://api-m.sandbox.paypal.com' para sa testing

// Helper para makakuha ng PayPal Access Token
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.access_token;
}

app.post('/payments/create', async (req, res) => {
    try {
        const token = await getPayPalAccessToken();
        const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'PHP', // Pwede ring 'USD' depende sa preference mo
                    value: (req.body.amount / 100).toFixed(2) // Convert cents to decimal
                },
                description: req.body.description
            }],
            application_context: {
                return_url: 'https://example.com/return',
                cancel_url: 'https://example.com/cancel'
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const order = response.data;
        const approveLink = order.links.find(link => link.rel === 'approve').href;

        res.json({
            id: order.id,
            status: order.status,
            checkout_url: approveLink
        });
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(400).json({ error: "PayPal order creation failed." });
    }
});

app.get('/payments/status/:id', async (req, res) => {
    try {
        const token = await getPayPalAccessToken();
        const response = await axios.get(`${PAYPAL_API}/v2/checkout/orders/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({
            id: response.data.id,
            status: response.data.status // Lalabas na 'COMPLETED' kapag bayad na
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai PayPal Server LIVE"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
