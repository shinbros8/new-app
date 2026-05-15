const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) throw new Error("Missing SECRET_KEY in Render Settings");

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

        const methodId = method.data.data.id;

        // 3. Attach Method
        const attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: methodId } }
        }, { headers: { Authorization: authHeader } });

        const attr = attachment.data.data.attributes;

        // --- SAFE CHECK PARA SA QR CODE ---
        let qrCode = null;
        if (attr.next_action && attr.next_action.show_qr_code) {
            qrCode = attr.next_action.show_qr_code.url;
        }

        // Kung walang QR Code, huwag mag-crash, magbigay ng message
        if (!qrCode) {
            console.log("PayMongo Status:", attr.status);
            return res.status(400).json({ 
                error: `PayMongo status is '${attr.status}' but no QR code was generated. Please check your PayMongo Dashboard if QRPh is enabled.` 
            });
        }

        res.json({
            id: intentId,
            status: attr.status,
            amount: attr.amount,
            checkout_url: null,
            qr_code: qrCode
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
        res.json({
            id: req.params.id,
            status: attr.status,
            amount: attr.amount,
            checkout_url: null,
            qr_code: null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => res.send("Pow.ai Payment Server is LIVE and Ready!"));
app.listen(process.env.PORT || 3000, '0.0.0.0');
