const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

app.post('/payments/create', async (req, res) => {
    try {
        if (!SECRET_KEY) throw new Error("Missing SECRET_KEY in Render Environment Variables");

        // Basic Auth: Secret Key + Colon (:) encoded in Base64
        const authHeader = `Basic ${Buffer.from(SECRET_KEY + ':').toString('base64')}`;
        const { amount, description } = req.body;

        console.log("Step 1: Creating Payment Intent...");
        const intent = await axios.post('https://api.paymongo.com/v1/payment_intents', {
            data: { attributes: { amount, payment_method_allowed: ['qrph'], currency: 'PHP', description } }
        }, { headers: { Authorization: authHeader } });

        const intentId = intent.data.data.id;

        console.log("Step 2: Creating Payment Method...");
        const method = await axios.post('https://api.paymongo.com/v1/payment_methods', {
            data: { attributes: { type: 'qrph' } }
        }, { headers: { Authorization: authHeader } });

        const methodId = method.data.data.id;

        console.log("Step 3: Attaching Method to Intent...");
        const attachment = await axios.post(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, {
            data: { attributes: { payment_method: methodId } }
        }, { headers: { Authorization: authHeader } });

        const nextAction = attachment.data.data.attributes.next_action;

        if (nextAction && nextAction.show_qr_code) {
            console.log("Success! QR URL generated.");
            res.json({
                id: intentId,
                qr_code: nextAction.show_qr_code.url,
                status: "awaiting_payment"
            });
        } else {
            throw new Error("PayMongo did not return a QR code URL.");
        }

    } catch (error) {
        const errorMessage = error.response?.data?.errors?.[0]?.detail || error.message;
        console.error("PayMongo Error:", errorMessage);
        res.status(400).json({ error: errorMessage });
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

app.get('/', (req, res) => res.send("Pow.ai Backend is Online and Ready!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));