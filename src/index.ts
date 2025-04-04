import express, { Request, Response } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "your-gemini-api-key",
});

app.post(
  "/analyze-pdf",
  upload.single("pdf"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No PDF file uploaded" });
        return;
      }

      const pdfFile = req.file.path;
      const dataBuffer = fs.readFileSync(pdfFile);

      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text;

      const prompt = `
You are an expert in medical report analysis. Analyze the following PDF report and return a structured JSON response with the following format:

{
  "patient": {
    "name": "Patient Name",
    "testName": "Test Name",
    "date": "Report Date",
    "time": "Test Time"
    "hospitalName": "Hospital Name",
  },
  "tests": [
    {
      "sampleTest": "Hemoglobin",
      "result": "13.5",
      "unit": "g/dL",
      "bioRef": "13.0 - 17.0",
      "advisory": [
        "What does the results tell about the current state",
        "What precautions should patient take.",
        "Suggest medical apparatus or equipment that the patient can purchase from Omron Global"
      ]
    },
    {
      "sampleTest": "WBC",
      "result": "8.4",
      "unit": "x10^3/uL",
      "bioRef": "4.0 - 11.0",
      "advisory": [
        "What does the results tell about the current state",
        "What precautions should patient take.",
        "Suggest medical apparatus or equipment that the patient can purchase from Omron Global"
      ]
    }
  ]
}

Text to analyze:
${extractedText.slice(0)}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: prompt,
      });

      fs.unlinkSync(pdfFile);
      const cleanResponse = response
        .text!.replace(/```json/g, "")
        .replace(/```/g, "");
      const parsedResponse = JSON.parse(cleanResponse);
      console.log(parsedResponse);
      res.json({ analysis: parsedResponse });
    } catch (error) {
      console.error("PDF Text Extraction Error:", error);
      res.status(500).json({ error: "Failed to extract text from PDF" });
    }
  }
);

app.get("/", (req: Request, res: Response) => {
  res.json({ msg: "Hello World!!" });
});

app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
