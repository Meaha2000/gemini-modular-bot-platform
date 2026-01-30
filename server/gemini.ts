import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "webSearch",
        description: "Search the web for real-time information and news.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query." }
          },
          required: ["query"]
        }
      }
    ]
  }
];

export async function chatWithGemini(
  userId: string,
  chatId: string,
  prompt: string,
  media: any[] = []
) {
  // 1. Get API Keys (Round-robin logic via last_used_at)
  const keys = db.prepare("SELECT * FROM gemini_keys WHERE user_id = ? AND status = 'active' ORDER BY last_used_at ASC").all(userId) as any[];

  if (keys.length === 0) {
    throw new Error('No active Gemini API keys found');
  }

  // 2. Get Active Personality
  const personality = db.prepare('SELECT * FROM personalities WHERE user_id = ? AND is_active = 1').get(userId) as any 
    || { system_prompt: "You are a helpful assistant." };

  // 3. Get Memory
  let memoryRecord = db.prepare('SELECT * FROM memories WHERE user_id = ? AND chat_id = ?').get(userId, chatId) as any;
  let history = memoryRecord ? JSON.parse(memoryRecord.context) : [];

  // 4. Gemini Request with Rotation/Retry
  let responseText = "";
  let usedKeyId = "";
  let lastError = null;
  let rawResponse = "";

  for (const keyObj of keys) {
    try {
      const genAI = new GoogleGenerativeAI(keyObj.key);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: personality.system_prompt,
        tools: TOOLS as any
      });

      const parts: any[] = [{ text: prompt }];
      for (const item of media) {
        parts.push({
          inlineData: {
            data: item.data, // base64
            mimeType: item.mimeType
          }
        });
      }

      const chat = model.startChat({
        history: history.slice(-20).map((h: any) => ({
          role: h.role,
          parts: [{ text: h.content }]
        }))
      });

      let result = await chat.sendMessage(parts);
      rawResponse = JSON.stringify(result.response);
      
      // Handle Function Calls (Tools)
      const calls = result.response.functionCalls();
      if (calls && calls.length > 0) {
        const functionResponses = [];
        for (const call of calls) {
          console.log(`Tool call received: ${call.name}`, call.args);
          let toolResult = "Tool feature coming soon (simulated search)";
          
          // In real self-hosted, we'd implement real search here
          // but for now we follow the logic structure
          
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { content: toolResult }
            }
          });
        }
        result = await chat.sendMessage(functionResponses);
        rawResponse += "\n---TOOL RESPONSE---\n" + JSON.stringify(result.response);
      }

      responseText = result.response.text();
      usedKeyId = keyObj.id;
      
      // Update key usage
      db.prepare('UPDATE gemini_keys SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), keyObj.id);
      break;
    } catch (e: any) {
      console.error(`Key ${keyObj.id} failed:`, e.message);
      lastError = e.message;
      if (e.message.includes("429")) {
        // Rate limited, continue to next key
        continue;
      } else {
        // Other error, also try next key
        continue;
      }
    }
  }

  if (!responseText) {
    throw new Error("All API keys failed. Last error: " + lastError);
  }

  // 5. Update Memory
  const newHistory = [...history, { role: "user", content: prompt }, { role: "model", content: responseText }];
  const contextJson = JSON.stringify(newHistory.slice(-50));
  
  if (memoryRecord) {
    db.prepare('UPDATE memories SET context = ?, updated_at = ? WHERE id = ?').run(contextJson, new Date().toISOString(), memoryRecord.id);
  } else {
    db.prepare('INSERT INTO memories (id, chat_id, context, user_id) VALUES (?, ?, ?, ?)').run(`mem_${Date.now()}`, chatId, contextJson, userId);
  }

  // 6. Log Transaction
  db.prepare('INSERT INTO bot_logs (id, request_payload, response_payload, raw_response, api_key_used, user_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(`log_${Date.now()}`, JSON.stringify({ prompt, chatId }), responseText, rawResponse, usedKeyId, userId);

  return { response: responseText, keyId: usedKeyId };
}
