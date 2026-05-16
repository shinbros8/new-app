const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PayPal Credentials - Using Environment Variables for Security
const clientId = process.env.PAYPAL_CLIENT_ID || "AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3";
const mode = (process.env.PAYPAL_MODE || 'live').toLowerCase();

console.log("------------------------------------------");
console.log(`PayPal Mode: ${mode.toUpperCase()}`);
console.log(`Using Client ID starting with: ${clientId.substring(0, 10)}...`);
console.log("------------------------------------------");

// Environment Setup
let environment = mode === 'live'
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

let client = new paypal.core.PayPalHttpClient(environment);

// Endpoint: Create Payment
app.post('/payments/create', async (req, res) => {
    const { amount, description } = req.body;
    const formattedAmount = (amount / 100).toFixed(2);

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: formattedAmount
            },
            description: description || "Pow.ai Subscription"
        }],
        application_context: {
            brand_name: "Pow.ai",
            user_action: "PAY_NOW",
            return_url: "powai://payment-success",
            cancel_url: "powai://payment-cancel"
        }
    });

    try {
        const order = await client.execute(request);
        const approveLink = order.result.links.find(link => link.rel === 'approve');

        res.json({
            id: order.result.id,
            status: order.result.status,
            amount: amount,
            checkout_url: approveLink ? approveLink.href : null,
            qr_code: null
        });
    } catch (err) {
        console.error("Create Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint: Verify Status
app.get('/payments/status/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const getOrder = new paypal.orders.OrdersGetRequest(orderId);
        const order = await client.execute(getOrder);

        if (order.result.status === 'APPROVED') {
            const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
            const capture = await client.execute(captureRequest);
            return res.json({
                id: orderId,
                status: capture.result.status,
                amount: 0,
                checkout_url: null,
                qr_code: null
            });
        }

        res.json({
            id: orderId,
            status: order.result.status,
            amount: 0,
            checkout_url: null,
            qr_code: null
        });
    } catch (err) {
        if (err.message && err.message.includes("ORDER_ALREADY_CAPTURED")) {
            return res.json({ id: orderId, status: 'COMPLETED', amount: 0, checkout_url: null, qr_code: null });
        }
        res.status(500).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.send(`Pow.ai PayPal Backend is Running in ${mode} mode!`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} in ${mode} mode`));
