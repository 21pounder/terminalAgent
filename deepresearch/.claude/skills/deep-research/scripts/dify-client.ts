/**
 * Dify Deep Research Client
 *
 * 调用 Dify 平台上部署的 Deep Research Agent
 */

interface DifyConfig {
  apiKey: string;
  baseUrl: string;
  agentId?: string;
}

interface ResearchRequest {
  topic: string;
  depth?: "quick" | "standard" | "comprehensive";
  sources?: number;
  language?: string;
}

interface ResearchResponse {
  success: boolean;
  data?: {
    summary: string;
    findings: string[];
    sources: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    analysis: string;
  };
  error?: string;
}

export class DifyResearchClient {
  private config: DifyConfig;

  constructor(config: DifyConfig) {
    this.config = {
      baseUrl: config.baseUrl || process.env.DIFY_BASE_URL || "https://api.dify.ai/v1",
      apiKey: config.apiKey || process.env.DIFY_API_KEY || "",
      agentId: config.agentId || process.env.DIFY_RESEARCH_AGENT_ID,
    };
  }

  /**
   * 执行深度研究
   */
  async research(request: ResearchRequest): Promise<ResearchResponse> {
    const { topic, depth = "standard", sources = 5, language = "auto" } = request;

    try {
      const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {
            topic,
            depth,
            min_sources: sources,
            language,
          },
          query: topic,
          response_mode: "blocking",
          user: "terminal-agent",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Dify API error: ${response.status} - ${errorText}`,
        };
      }

      const result = await response.json();

      // 解析 Dify 返回的结果
      return {
        success: true,
        data: this.parseResearchResult(result.answer),
      };
    } catch (error) {
      return {
        success: false,
        error: `Research failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 流式执行深度研究
   */
  async *researchStream(request: ResearchRequest): AsyncGenerator<string> {
    const { topic, depth = "standard", sources = 5, language = "auto" } = request;

    const response = await fetch(`${this.config.baseUrl}/chat-messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          topic,
          depth,
          min_sources: sources,
          language,
        },
        query: topic,
        response_mode: "streaming",
        user: "terminal-agent",
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Dify API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.event === "message" && data.answer) {
            yield data.answer;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * 解析研究结果
   */
  private parseResearchResult(answer: string): ResearchResponse["data"] {
    // 简单解析，实际可根据 Dify Agent 的输出格式调整
    return {
      summary: answer.split("\n")[0] || "",
      findings: [],
      sources: [],
      analysis: answer,
    };
  }
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const topic = process.argv[2];
  if (!topic) {
    console.error("Usage: dify-client.ts <topic>");
    process.exit(1);
  }

  const client = new DifyResearchClient({
    apiKey: process.env.DIFY_API_KEY || "",
    baseUrl: process.env.DIFY_BASE_URL || "",
  });

  client.research({ topic }).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}
