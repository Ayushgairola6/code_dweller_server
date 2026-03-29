import express from "express";
import cors from "cors";
import { RequestHandler } from "./Orchestration/Orchestrator.main.ts";
import { VerifyKey } from "./Middlewares/VerifyKey.ts";
import { v4 as uuid } from "uuid";
const app = express();

app.use(cors());
app.use(express.json());

app.post("/ping", (req, res) => {
  console.log("pinged");
  res.json({ status: true });
});

app.get("/assign-session", VerifyKey, (req, res) => {
  const sesion_id = uuid();
  return res.json({
    message: "New session_id assigned",
    session_id: sesion_id,
  });
});

app.post("/agent/resolve", VerifyKey, RequestHandler);

app.listen(4332, () => console.log("running on 4332"));
