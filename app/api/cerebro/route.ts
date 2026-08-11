import { GoogleGenAI } from "@google/genai";
import { tools } from "@/lib/tools/definitions";
import { ejecutarHerramienta } from "@/lib/tools/router";
import { NextResponse } from "next/server";

// ─── Configuración de Gemini ─────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY || GEMINI_API_KEY === "tu_api_key_aqui") {
  console.warn(
    "⚠️  GEMINI_API_KEY no configurada. El endpoint /api/cerebro no funcionará."
  );
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

// ─── System Prompt ───────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente de gestión "Segundo Cerebro". Tu trabajo es interpretar las instrucciones del usuario en español y ejecutar la herramienta correcta.

REGLAS:
1. SIEMPRE usa una de las herramientas disponibles para responder. No inventes datos.
2. Normaliza los nombres de proyecto a MAYÚSCULAS (ej: "jordan" → "JORDAN", "24on" → "24ON").
3. Si el usuario no menciona un proyecto explícitamente, pregúntale a cuál proyecto se refiere.
4. Responde siempre en español, de forma concisa y profesional.
5. Si la acción se ejecutó correctamente, confirma al usuario qué se hizo.
6. Si hubo un error, explica qué falló y sugiere cómo corregirlo.
7. Para las fechas, usa el contexto para inferir (ej: "mañana", "el viernes", "fin de mes").
8. Hoy es ${new Date().toISOString().split("T")[0]}.`;

// ─── POST /api/cerebro ──────────────────────────────────
export async function POST(request: Request) {
  try {
    // Validar API Key
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "tu_api_key_aqui") {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY no está configurada. Agrega tu key en .env.local",
        },
        { status: 500 }
      );
    }

    // Leer el mensaje del usuario
    const body = await request.json();
    const { mensaje } = body;

    if (!mensaje || typeof mensaje !== "string") {
      return NextResponse.json(
        { error: 'Se requiere un campo "mensaje" con texto.' },
        { status: 400 }
      );
    }

    // Paso 1: Enviar a Gemini con las herramientas
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: mensaje }] }],
      config: {
        tools,
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    // Paso 2: Verificar si Gemini quiere llamar una función
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (!parts || parts.length === 0) {
      return NextResponse.json({
        respuesta: "No pude procesar tu mensaje. ¿Podrías reformularlo?",
      });
    }

    // Verificar si hay un function call
    const functionCall = parts.find((p) => p.functionCall)?.functionCall;

    if (!functionCall) {
      // Gemini respondió con texto directo (ej: pidió aclaración)
      const textoRespuesta = parts.find((p) => p.text)?.text;
      return NextResponse.json({
        respuesta:
          textoRespuesta ||
          "No pude determinar qué acción tomar. ¿Podrías ser más específico?",
      });
    }

    // Paso 3: Ejecutar la herramienta correspondiente
    console.log(
      `🛠️  Ejecutando: ${functionCall.name}`,
      JSON.stringify(functionCall.args)
    );

    const resultadoHerramienta = await ejecutarHerramienta(
      functionCall.name!,
      (functionCall.args as Record<string, unknown>) || {}
    );

    // Paso 4: Enviar el resultado de vuelta a Gemini para respuesta natural
    const followUpResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: mensaje }] },
        {
          role: "model",
          parts: [
            {
              functionCall: {
                name: functionCall.name!,
                args: functionCall.args || {},
              },
            },
          ],
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionCall.name!,
                response: JSON.parse(resultadoHerramienta),
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    const respuestaFinal =
      followUpResponse.candidates?.[0]?.content?.parts?.find((p) => p.text)
        ?.text || "Acción ejecutada correctamente.";

    return NextResponse.json({
      respuesta: respuestaFinal,
      herramienta_usada: functionCall.name,
      argumentos: functionCall.args,
    });
  } catch (error) {
    console.error("❌ Error en /api/cerebro:", error);
    return NextResponse.json(
      {
        error: `Error interno: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
