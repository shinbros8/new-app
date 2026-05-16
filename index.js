const express = require('express');
const axios = require('axios');const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

// Helper function para mag-antay
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) throw new Error("Missing SECRET_KEY");
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const amount = parseInt(req.body.amount);
        const description = req.body.description;

        // 1. Create Payment Intent
        const intent = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: { attributes: { amount, payment_method_allowed: ['qrph'], currency: 'PHP', description } }
        }, { headers: { Authorization: authHeader } });

        const intentId = intent.data.data.id;

        // 2. Create Payment Method (QRPH)
        const method = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        const methodId = method.data.data.id;

        // 3. Attach Method
        let attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: methodId } }
        }, { headers: { Authorization: authHeader } });

        let attr = attachment.data.data.attributes;

        // --- RETRY LOGIC: Kung wala pang QR, hintay ng 2 seconds ---
        if (attr.status === 'awaiting_next_action' && (!attr.next_action || !attr.next_action.show_qr_code)) {
            await wait(2000); // Mag-antay ng 2 seconds
            const refresh = await axios.get(`https://api.paymongo.com/v1/payment_intents/${intentId}`, {
                headers: { Authorization: authHeader }
            });
            attr = refresh.data.data.attributes;
        }

        // --- KUHAIN ANG URL ---
        const qrCodeUrl = attr.next_action?.show_qr_code?.url || attr.next_action?.redirect?.url;

        if (!qrCodeUrl) {
            return res.status(400).json({ error: "QR Code generation failed. Please check PayMongo Dashboard." });
        }

        res.json({
            id: intentId,
            status: attr.status,
            amount: attr.amount,
            checkout_url: qrCodeUrl,
            qr_code: qrCodeUrl
        });

    } catch (error) {
        const msg = error.response?.data?.errors?.[0]?.detail || error.message;
        res.status(400).json({ error: msg });
    }
});

app.get('/payments/status/:id', async (req, res) => {
    try {
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const response = await axios.get(`https://api.paymongo.com/v1/payment_intents/${req.params.id}`, {
            headers: { Authorization: authHeader }
        });
        res.json({ id: req.params.id, status: response.data.data.attributes.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Payment Server LIVE"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
