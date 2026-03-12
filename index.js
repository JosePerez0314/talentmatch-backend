import express from 'express';
import candidates from "./routes/candidates.js";

const app = express();
const port = 3000;

app.use(express.json());

app.use("/api/candidates/", candidates);

app.listen(port, () => {
    console.log(`The server is running in http://localhost:${port}/api/candidates`);
});