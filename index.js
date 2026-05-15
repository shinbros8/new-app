const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        // 1. Create Intent
        const intent = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: { attributes: { amount, payment_method_allowed: ['qrph'], currency: 'PHP', description } }
        }, { headers: { Authorization: authHeader } });

        const intentId = intent.data.data.id;

        // 2. Create Method
        const method = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        // 3. Attach
        const attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: method.data.data.id } }
        }, { headers: { Authorization: authHeader } });

        const attr = attachment.data.data.attributes;

        // --- FALLBACK LOGIC ---
        let finalQrUrl = null;
        
        // Subukan kunin ang QR Image URL
        if (attr.next_action && attr.next_action.show_qr_code) {
            finalQrUrl = attr.next_action.show_qr_code.url;
        } 
        
        // Kung walang QR Image, gamitin ang Checkout URL (bilang huling bala)
        if (!finalQrUrl) {
            console.log("No QR Image found, providing checkout URL instead.");
            // Note: Ang QRPh minsan ay nagbibigay lang ng redirect link
            finalQrUrl = attr.next_action?.redirect?.url || null;
        }

        if (!finalQrUrl) {
            return res.status(400).json({ 
                error: "Your PayMongo account does not support QRPh Live yet. Please use Test Mode or contact PayMongo support." 
            });
        }

        res.json({
            id: intentId,
            status: attr.status,
            amount: amount,
            checkout_url: finalQrUrl,
            qr_code: finalQrUrl // I-send natin sa parehong field para sigurado
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
        const attr = response.data.data.attributes;
        res.json({ id: req.params.id, status: attr.status, amount: attr.amount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Server is Ready!"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
