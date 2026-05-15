const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

// Helper function para mag-antay (sleep)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) throw new Error("Missing SECRET_KEY");
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        // 1. Create Payment Intent
        const intent = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: { attributes: { amount, payment_method_allowed: ['qrph'], currency: 'PHP', description } }
        }, { headers: { Authorization: authHeader } });

        const intentId = intent.data.data.id;

        // 2. Create Payment Method
        const method = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        const methodId = method.data.data.id;

        // 3. Attach Method
        let attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: methodId } }
        }, { headers: { Authorization: authHeader } });

        let attr = attachment.data.data.attributes;

        // --- RETRY LOGIC (Importante!) ---
        // Kung awaiting_next_action pero wala pang QR, tanungin ulit ang PayMongo pagkalipas ng 2 segundo
        if (attr.status === 'awaiting_next_action' && (!attr.next_action || !attr.next_action.show_qr_code)) {
            console.log("QR not ready, waiting 2 seconds...");
            await wait(2000);
            const refresh = await axios.get(`https://api.paymongo.com/v1/payment_intents/${intentId}`, {
                headers: { Authorization: authHeader }
            });
            attr = refresh.data.data.attributes;
        }

        // --- HANAPIN ANG URL ---
        let finalUrl = null;
        if (attr.next_action) {
            if (attr.next_action.show_qr_code) {
                finalUrl = attr.next_action.show_qr_code.url;
            } else if (attr.next_action.redirect) {
                finalUrl = attr.next_action.redirect.url;
            }
        }

        if (!finalUrl) {
            return res.status(400).json({ 
                error: `PayMongo status: ${attr.status}. QR code still not generated. Please try again or check PayMongo Dashboard.` 
            });
        }

        res.json({
            id: intentId,
            status: attr.status,
            amount: amount,
            checkout_url: finalUrl,
            qr_code: finalUrl
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

app.get('/', (req, res) => res.send("Pow.ai Payment Server is LIVE"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
