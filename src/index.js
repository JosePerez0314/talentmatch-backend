import express from 'express';
import users from "./routes/users.js"
import positions from "./routes/positions.js"
import uploads from "./routes/uploads.js"

const app = express();
const port = 3000;

app.use(express.json());

app.use("/api/users/", users);
app.use("/api/positions/", positions);
app.use("/api/uploads/", uploads);

app.listen(port, () => {
    console.log(`The server is running in http://localhost:${port}/api/users`);
});