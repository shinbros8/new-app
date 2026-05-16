const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. PayPal Environment Setup
const clientId = "AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go";
const clientSecret = "ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3";

// Gamitin ang SandboxEnvironment para sa testing, LiveEnvironment para sa production
let environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
let client = new paypal.core.PayPalHttpClient(environment);

// 2. Endpoint: Create Payment (Order)
app.post('/payments/create', async (req, res) => {
    const { amount, description } = req.body; 
    // Ang 'amount' ay galing sa app (e.g., 500 = 5.00)
    const formattedAmount = (amount / 100).toFixed(2); 

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD', // O 'PHP' kung supported ng account mo
                value: formattedAmount
            },
            description: description || "Pow.ai Premium Subscription"
        }],
        application_context: {
            brand_name: "Pow.ai",
            landing_page: "NO_PREFERENCE",
            user_action: "PAY_NOW",
            // DITO BABALIK ANG APP PAGKATAPOS MAG-PAY
            return_url: "powai://payment-success", 
            cancel_url: "powai://payment-cancel"
        }
    });

    try {
        const order = await client.execute(request);
        
        // Hanapin ang approve link sa links array ng PayPal
        const approveLink = order.result.links.find(link => link.rel === 'approve');

        res.json({
            id: order.result.id,
            status: order.result.status,
            amount: amount,
            checkout_url: approveLink ? approveLink.href : null,
            qr_code: null // Hindi kailangan sa PayPal Redirect flow
        });
    } catch (err) {
        console.error("PayPal Create Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Endpoint: Get Payment Status (Verify)
app.get('/payments/status/:id', async (req, res) => {
    const orderId = req.params.id;

    const request = new paypal.orders.OrdersGetRequest(orderId);

    try {
        const order = await client.execute(request);
        const status = order.result.status;

        // Kung APPROVED na ang status, i-capture na natin ang payment
        if (status === 'APPROVED') {
            const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
            const capture = await client.execute(captureRequest);
            return res.json({
                id: orderId,
                status: capture.result.status, // Magiging 'COMPLETED'
                amount: 0 // Optional: query from capture result if needed
            });
        }

        res.json({
            id: orderId,
            status: status, // Pwedeng 'CREATED', 'SAVED', 'APPROVED', o 'COMPLETED'
            amount: 0
        });
    } catch (err) {
        console.error("PayPal Status Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Root route for testing
app.get('/', (req, res) => {
    res.send('Pow.ai PayPal Backend is Running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
