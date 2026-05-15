const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) return res.status(500).json({ error: "Missing API Key" });

        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        // 1. Create Payment Intent
        const intentResponse = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: {
                attributes: {
                    amount: amount,
                    payment_method_allowed: ['qrph'],
                    currency: 'PHP',
                    description: description
                }
            }
        }, { headers: { Authorization: authHeader } });

        const intent = intentResponse.data.data;

        // 2. Create Payment Method
        const methodResponse = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        const method = methodResponse.data.data;

        // 3. Attach (Dito lalabas ang QR code)
        const attachResponse = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intent.id}/attach`, {
            data: {
                attributes: {
                    payment_method: method.id,
                    client_key: intent.attributes.client_key
                }
            }
        }, { headers: { Authorization: authHeader } });

        const attr = attachResponse.data.data.attributes;

        if (attr.next_action && attr.next_action.show_qr_code) {
            res.json({
                id: intent.id,
                status: attr.status,
                amount: attr.amount,
                qr_code: attr.next_action.show_qr_code.url
            });
        } else {
            res.status(400).json({ error: "PayMongo did not return a QR code. Please check your Dashboard if QRPh is enabled." });
        }

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
        res.json({ id: req.params.id, status: response.data.data.attributes.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Server is LIVE"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
