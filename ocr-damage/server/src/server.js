require("dotenv").config();
const express = require("express");
const cors = require("cors");
const medicineRoutes = require("./routes/medicineRoutes");


const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/medicine", medicineRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "PharmaShield AI backend is running!"
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});