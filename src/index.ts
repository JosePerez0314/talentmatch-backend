import "dotenv/config";
import app from "./app.js";

const port = process.env.PORT || 3000;

// SERVER LISTEN (ABSOLUTE BOTTOM)
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
