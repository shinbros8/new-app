const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAYPAL_CLIENT_ID = 'AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go';
const PAYPAL_SECRET = 'ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3';
const PAYPAL_API = 'https://api-m.paypal.com'; // Live API

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
                    currency_code: 'PHP',
                    value: (req.body.amount / 100).toFixed(2)
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

        const approveLink = response.data.links.find(link => link.rel === 'approve').href;
        res.json({
            id: response.data.id,
            status: response.data.status,
            checkout_url: approveLink
        });
    } catch (error) {
        res.status(400).json({ error: "PayPal Error" });
    }
});

app.get('/payments/status/:id', async (req, res) => {
    try {
        const token = await getPayPalAccessToken();
        const response = await axios.get(`${PAYPAL_API}/v2/checkout/orders/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ id: response.data.id, status: response.data.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(process.env.PORT || 3000);
