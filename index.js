// ... (sa loob ng index.js, i-update ang create endpoint)
        if (nextAction && nextAction.show_qr_code) {
            res.json({
                id: intent.id,
                status: attr.status,
                qr_code: nextAction.show_qr_code.url
            });
        } else {
            // ITO ANG MAHALAGA: Sasabihin nito kung ano ang status (hal. 'processing', 'failed')
            res.status(400).json({ 
                error: `PayMongo Status: ${attr.status}. QRPh might not be enabled on your account yet. Please check Settings > Payment Methods in PayMongo Dashboard.` 
            });
        }
