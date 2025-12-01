import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import canvas from "canvas";
import * as faceapi from "@vladmandic/face-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'models')));

// Configura upload
const upload = multer({ dest: path.join(__dirname, "uploads/") });

// Inicializa face-api.js com NodeCanvas
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Função para carregar modelos (inclui faceExpressionNet!)
async function carregarModelos() {
  await faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, "models"));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, "models"));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, "models"));
  await faceapi.nets.faceExpressionNet.loadFromDisk(path.join(__dirname, "models")); // crucial pra emoção
  console.log("Modelos carregados no servidor!");
}

// Carregamento imediato dos modelos na inicialização do servidor
await carregarModelos();

// Endpoint para processar imagem e detectar emoção
app.post("/processar-foto", upload.single("foto"), async (req, res) => {
  try {
    const img = await canvas.loadImage(req.file.path);

    // Detecta faces com emoção
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    fs.unlinkSync(req.file.path); // apaga o upload do disco

    if (detections.length === 0) {
      return res.json({ facesEncontradas: 0 });
    }

    // Considera a primeira face para emoção (você pode estender se quiser)
    const expressao = detections[0].expressions;
    const emocao = Object.keys(expressao).reduce((a, b) =>
      expressao[a] > expressao[b] ? a : b
    );
    const confianca = expressao[emocao];

    res.json({
      facesEncontradas: detections.length,
      emocao,
      confianca: Math.round(confianca * 100), // %
    });
  } catch (err) {
    console.error("Erro no processamento da imagem:", err);
    res.status(500).json({ erro: "Erro ao processar imagem" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
