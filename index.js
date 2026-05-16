// C:/Users/un364/powai/backend/index.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const paypal = require('@paypal/checkout-server-sdk');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PayPal Credentials
const clientId = process.env.PAYPAL_CLIENT_ID || "AZUcAHvmopKagMv4Afte76e-cThAJ_RMDZvTVIPIRdWw-QgEseTfSDk6OCy1Qx0eeU7BFOIAGxhj4-go";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "ELitHCbCxJjG8VPsHBkfW7eTFFK-uQccD4aug2B-RMkC3dn8HWOvL5RgauhkZsKI3yF5KYkH0ycvCyL3";
const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

console.log("------------------------------------------");
console.log(`PayPal Mode: ${mode.toUpperCase()}`);
console.log(`Using Client ID starting with: ${clientId.substring(0, 10)}...`);
console.log("------------------------------------------");

let environment = mode === 'live' 
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

let client = new paypal.core.PayPalHttpClient(environment);

// ... (rest of the endpoints)
