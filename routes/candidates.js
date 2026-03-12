import express from "express";

const router = express.Router();

router.post('/evaluar', (req, res) => {
    const payload = req.body;

    if (!payload) {
        res.status(400).json({ error: "Error to receive the data" });
        return;
    }

    console.log("Payload received", payload);
    payload && res.status(201).json({ mensaje: 'Data receive successfully' });
});

export default router;