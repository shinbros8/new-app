const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const clientId = "AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go";
const clientSecret = "ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3";

let environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
let client = new paypal.core.PayPalHttpClient(environment);

app.post('/payments/create', async (req, res) => {
    const { amount, description } = req.body;
    const formattedAmount = (amount / 100).toFixed(2); 

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: { currency_code: 'USD', value: formattedAmount },
            description: description || "Pow.ai Premium"
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
            checkout_url: approveLink ? approveLink.href : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/payments/status/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const getOrder = new paypal.orders.OrdersGetRequest(orderId);
        const order = await client.execute(getOrder);

        // KUNG APPROVED PA LANG, I-CAPTURE NA PARA MAGING PERA NA
        if (order.result.status === 'APPROVED') {
            const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);
            const capture = await client.execute(captureRequest);
            return res.json({ id: orderId, status: capture.result.status });
        }
        
        // KUNG COMPLETED NA O IBA PA, IBALIK LANG ANG STATUS
        res.json({ id: orderId, status: order.result.status });
    } catch (err) {
        // Kung nag-error dahil na-capture na (already captured), ibalik ang status na COMPLETED
        if (err.message.includes("ORDER_ALREADY_CAPTURED")) {
             return res.json({ id: orderId, status: 'COMPLETED' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Server Running"));
