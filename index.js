const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) throw new Error("Missing SECRET_KEY in Render Settings");

        // Auth Header Fix: Siguradong may colon (:) sa dulo
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        console.log("--- Payment Request Started ---");

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
        const attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: methodId } }
        }, { headers: { Authorization: authHeader } });

        const attr = attachment.data.data.attributes;
        const nextAction = attr.next_action;

        let qrCodeUrl = null;

        // Kunin ang QR Code URL mula sa iba't ibang posibleng location
        if (nextAction) {
            if (nextAction.show_qr_code) {
                qrCodeUrl = nextAction.show_qr_code.url;
            } else if (nextAction.redirect) {
                qrCodeUrl = nextAction.redirect.url;
            }
        }

        // Kung wala talagang mahanap na QR
        if (!qrCodeUrl) {
            console.error("PayMongo Response Data:", JSON.stringify(attr, null, 2));
            return res.status(400).json({ 
                error: `PayMongo status is '${attr.status}' but no QR code was generated. Please contact PayMongo support to verify your QRPh Live status.` 
            });
        }

        console.log("Success! QR/Link found:", qrCodeUrl);
        res.json({
            id: intentId,
            status: attr.status,
            amount: amount,
            checkout_url: qrCodeUrl,
            qr_code: qrCodeUrl
        });

    } catch (error) {
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
        const attr = response.data.data.attributes;
        res.json({ id: req.params.id, status: attr.status, amount: attr.amount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Payment Server is LIVE!"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
