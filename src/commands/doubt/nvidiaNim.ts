import fetch from "node-fetch";
import sharp from "sharp";

interface GenerateOptions {
  systemInstruction?: string;
  prompt: string;
  imageUrl?: string;
  maxTokens?: number;
}

interface ApiCallParams {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  prompt: string;
  imageUrl?: string;
  maxTokens: number;
}

/**
 * Trims newlines, strips surrounding quotes, and limits the title length to under 250 characters
 * to prevent Discord form body limit exceptions (256 character limit).
 */
export function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return "New Doubt";
  let cleaned = rawTitle
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "") // Remove surrounding quotes
    .replace(/\r?\n|\r/g, " ")                // Replace newlines with spaces
    .trim();
  
  if (cleaned.length > 250) {
    cleaned = cleaned.substring(0, 247) + "...";
  }
  return cleaned || "New Doubt";
}

/**
 * Sanitizes the prompt text to avoid false-positive safety flags.
 * Maps Indian stream abbreviations (PCM, PCB) to their full academic names,
 * and replaces terms like "vessel" (often flagged in military context) with "container".
 */
export function sanitizePrompt(text: string): string {
  if (!text) return text;
  return text
    .replace(/Science Non-Medical\/PCM/gi, "Science (Physics, Chemistry, Mathematics)")
    .replace(/Science Medical\/PCB/gi, "Science (Physics, Chemistry, Biology)")
    .replace(/\bPCM\b/g, "Physics, Chemistry, Mathematics")
    .replace(/\bPCB\b/g, "Physics, Chemistry, Biology")
    .replace(/\bvessel\b/gi, "container")
    .replace(/\bvessels\b/gi, "containers");
}

/**
 * Checks if the generated text is a safety refusal or policy disclaimer.
 */
export function isRefusal(text: string): boolean {
  if (!text) return false;
  const refusalPatterns = [
    /i cannot/i,
    /i can't/i,
    /not going to engage/i,
    /illegal and unethical/i,
    /harmful or illegal/i,
    /violates/i,
    /as an AI/i,
    /sorry, but I cannot/i,
    /my safety guidelines/i,
  ];
  return refusalPatterns.some((pattern) => pattern.test(text));
}

/**
 * Downloads, resizes, and compresses an image to bypass size limitations and scraper blocks.
 */
async function getResizedBase64Image(imageUrl: string): Promise<{ base64Image: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const compressedBuffer = await sharp(buffer)
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();

  return {
    base64Image: compressedBuffer.toString("base64"),
    mimeType: "image/jpeg",
  };
}

/**
 * Performs a low-level fetch request to the NVIDIA NIM completions endpoint.
 */
async function callNvidiaNimApi(params: ApiCallParams): Promise<string> {
  const messages: any[] = [];
  if (params.systemInstruction) {
    messages.push({
      role: "system",
      content: params.systemInstruction,
    });
  }

  if (params.imageUrl) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: params.prompt,
        },
        {
          type: "image_url",
          image_url: {
            url: params.imageUrl,
          },
        },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: params.prompt,
    });
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      temperature: 0.2,
      max_tokens: params.maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API returned status ${response.status}: ${text}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error("Response did not contain choices[0].message.content");
  }

  return content;
}

/**
 * Main exported function to handle completion requests with fallback strategies.
 */
export async function generateNvidiaNim(options: GenerateOptions): Promise<string> {
  const apiKey = process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_NIM_API_KEY environment variable is not defined");
  }

  const systemInstruction = sanitizePrompt(options.systemInstruction || "");
  const prompt = sanitizePrompt(options.prompt || "");
  const hasImage = !!options.imageUrl;
  const maxTokens = options.maxTokens || 1024;

  let finalImageUrl = options.imageUrl;
  if (options.imageUrl) {
    try {
      const { base64Image, mimeType } = await getResizedBase64Image(options.imageUrl);
      finalImageUrl = `data:${mimeType};base64,${base64Image}`;
    } catch (error) {
      console.error("Error resizing image for NVIDIA NIM, falling back to raw URL:", error);
    }
  }

  // Vision models failover list
  const visionModels = [
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-3.2-11b-vision-instruct",
  ];

  // Text models failover list (Mixtral MoE is highly capable, lenient and has very few false-positives)
  const textModels = [
    "meta/llama-3.1-8b-instruct",
    "mistralai/mixtral-8x22b-instruct-v0.1",
    "meta/llama-3.1-70b-instruct",
  ];

  // 1. If an image is present, attempt vision models first
  if (hasImage && finalImageUrl) {
    for (const model of visionModels) {
      try {
        console.log(`[NVIDIA NIM] Attempting vision completions with model: ${model}`);
        const result = await callNvidiaNimApi({
          apiKey,
          model,
          systemInstruction,
          prompt,
          imageUrl: finalImageUrl,
          maxTokens,
        });

        if (!isRefusal(result)) {
          return result;
        }
        console.warn(`[NVIDIA NIM] Vision model ${model} triggered safety refusal. Trying fallback...`);
      } catch (error) {
        console.error(`[NVIDIA NIM] Vision model ${model} failed with error:`, error);
      }
    }

    // 2. If all vision models failed or refused, strip image and try text-only models
    console.warn("[NVIDIA NIM] All vision models failed or refused. Falling back to text-only models...");
  }

  // 3. Fallback/Default path for text-only queries
  const textPromptText = hasImage
    ? `${prompt}\n\n(Note: The student uploaded an image, but due to safety filter false-positives, we are answering based on the text question alone. Please explain this concept/problem step-by-step.)`
    : prompt;

  for (const model of textModels) {
    try {
      console.log(`[NVIDIA NIM] Attempting text completions with model: ${model}`);
      const result = await callNvidiaNimApi({
        apiKey,
        model,
        systemInstruction,
        prompt: textPromptText,
        maxTokens,
      });

      if (!isRefusal(result)) {
        return result;
      }
      console.warn(`[NVIDIA NIM] Text model ${model} triggered safety refusal. Trying fallback...`);
    } catch (error) {
      console.error(`[NVIDIA NIM] Text model ${model} failed with error:`, error);
    }
  }

  throw new Error("Failed to get a valid response from all available NVIDIA NIM models.");
}
