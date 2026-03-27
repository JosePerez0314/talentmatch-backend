import express from "express";
import prisma from "../lib/prisma.js"

const router = express.Router();

router.get('/', async (req, res) => { });

router.post('/', async (req, res) => { });

router.put('/:id', async (req, res) => { });

router.delete('/:id', async (req, res) => { });

export default router;