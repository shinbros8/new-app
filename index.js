const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        // Auth Header (Dapat may colon sa dulo)
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        // 1. Create Payment Intent
        const intent = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: { attributes: { amount, payment_method_allowed: ['qrph'], currency: 'PHP', description } }
        }, { headers: { Authorization: authHeader } });

        const intentId = intent.data.data.id;

        // 2. Create Payment Method (QRPH)
        const method = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        // 3. Attach (Dito kukunin ang TOTOONG QR image URL)
        const attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: method.data.data.id } }
        }, { headers: { Authorization: authHeader } });

        // Ibibigay na natin ang lahat ng fields na kailangan ng Android App
        res.json({
            id: intentId,
            status: attachment.data.data.attributes.status,
            amount: amount,
            checkout_url: null,
            qr_code: attachment.data.data.attributes.next_action.show_qr_code.url
        });

    } catch (error) {
        // Pag nag-error, sasabihin natin kung bakit
        const msg = error.response?.data?.errors?.[0]?.detail || error.message;
        console.error("PayMongo Error:", msg);
        res.status(400).json({ error: msg });
    }
});

app.get('/payments/status/:id', async (req, res) => {
    try {
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const response = await axios.get(`https://api.paymongo.com/v1/payment_intents/${req.params.id}`, {
            headers: { Authorization: authHeader }
        });
        res.json({ 
            id: req.params.id, 
            status: response.data.data.attributes.status,
            amount: response.data.data.attributes.amount,
            qr_code: null,
            checkout_url: null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Payment Server is LIVE!"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
