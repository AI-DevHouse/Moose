// src/lib/requirement-analyzer.ts
// AI-powered requirement analysis to detect ALL external dependencies

import Anthropic from '@anthropic-ai/sdk';

export interface DetectedRequirement {
  service: string;           // "OpenAI GPT-4o-mini"
  category: string;          // "AI API" | "Database" | "Auth" | "Payment" etc.
  env_var: string;           // "OPENAI_API_KEY"
  required: boolean;         // true if critical, false if optional
  instructions: string;      // "Get from https://platform.openai.com/api-keys"
  setup_url: string;         // URL to get credentials
}

export class RequirementAnalyzer {
  private static instance: RequirementAnalyzer;
  private anthropic: Anthropic;

  private constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for RequirementAnalyzer');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  static getInstance(): RequirementAnalyzer {
    if (!RequirementAnalyzer.instance) {
      RequirementAnalyzer.instance = new RequirementAnalyzer();
    }
    return RequirementAnalyzer.instance;
  }

  /**
   * Analyze technical spec and detect ALL external dependencies
   * Cost: ~$0.01 per analysis
   */
  async analyzeSpec(technicalSpec: string | object): Promise<DetectedRequirement[]> {
    // Convert spec to string if it's an object
    const specText = typeof technicalSpec === 'string'
      ? technicalSpec
      : JSON.stringify(technicalSpec, null, 2);

    const prompt = this.buildAnalysisPrompt(specText);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';

      // Extract JSON from response (handle markdown code blocks)
      const cleanContent = this.stripMarkdownCodeBlocks(content);

      let requirements: DetectedRequirement[];
      try {
        const parsed = JSON.parse(cleanContent);
        requirements = parsed.requirements || parsed;
      } catch (parseError: any) {
        console.error('Failed to parse requirement analysis:', parseError.message);
        console.error('Response content:', content.substring(0, 500));
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Validate structure
      if (!Array.isArray(requirements)) {
        throw new Error('AI response is not an array of requirements');
      }

      console.log(`✅ Detected ${requirements.length} external dependencies`);
      return requirements;

    } catch (error: any) {
      console.error('Requirement analysis failed:', error.message);
      throw new Error(`Requirement analysis failed: ${error.message}`);
    }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildAnalysisPrompt(specText: string): string {
    return `Analyze this technical specification and identify ALL external dependencies and services that require credentials, API keys, or external configuration.

**Technical Specification:**
${specText}

**Your Task:**
Identify all external dependencies across these categories:

1. **APIs and Third-Party Services:**
   - AI/ML APIs (OpenAI, Anthropic, Cohere, Hugging Face, etc.)
   - Payment processors (Stripe, PayPal, Square, etc.)
   - Communication (Twilio, SendGrid, Mailgun, Postmark, etc.)
   - Social media APIs (Twitter, Facebook, LinkedIn, etc.)
   - Maps and location (Google Maps, Mapbox, etc.)
   - Any other third-party APIs mentioned

2. **Infrastructure:**
   - Databases (PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, etc.)
   - Message queues (RabbitMQ, Kafka, SQS, etc.)
   - Caching systems
   - Search engines

3. **Authentication & Authorization:**
   - Auth providers (Auth0, Clerk, Supabase Auth, Firebase Auth, etc.)
   - OAuth integrations
   - SSO systems

4. **Storage:**
   - Cloud storage (AWS S3, Google Cloud Storage, Cloudinary, etc.)
   - CDNs

5. **Monitoring & Analytics:**
   - Error tracking (Sentry, Rollbar, Bugsnag, etc.)
   - Analytics (Google Analytics, Mixpanel, Amplitude, etc.)
   - Logging (LogRocket, Datadog, etc.)

6. **Deployment & DevOps:**
   - Hosting platforms (Vercel, Netlify, Heroku, AWS, etc.)
   - CI/CD services
   - Container registries

**For each dependency, provide:**
- **service**: Full name of the service (e.g., "OpenAI GPT-4o-mini")
- **category**: One of: "AI API", "Payment Processing", "Email Service", "SMS Service", "Database", "Authentication", "Storage", "Monitoring", "Analytics", "Deployment", "Other"
- **env_var**: Standard environment variable name (e.g., "OPENAI_API_KEY")
- **required**: true if critical for core functionality, false if optional
- **instructions**: Brief setup instructions (1-2 sentences)
- **setup_url**: URL where user can obtain credentials

**Important:**
- Only include services that actually require credentials or external setup
- Don't include standard npm packages or libraries
- Don't include internal services or localhost
- If a service is mentioned but seems optional, mark required: false

**Output Format:**
Return a JSON array of requirements. Example:

\`\`\`json
[
  {
    "service": "OpenAI GPT-4o-mini",
    "category": "AI API",
    "env_var": "OPENAI_API_KEY",
    "required": true,
    "instructions": "Create an API key in your OpenAI dashboard under API Keys section",
    "setup_url": "https://platform.openai.com/api-keys"
  },
  {
    "service": "Stripe",
    "category": "Payment Processing",
    "env_var": "STRIPE_SECRET_KEY",
    "required": true,
    "instructions": "Get your secret key from Stripe Dashboard under Developers > API keys",
    "setup_url": "https://dashboard.stripe.com/apikeys"
  }
]
\`\`\`

If no external dependencies are found, return an empty array: \`[]\`

Now analyze the specification and return the JSON array:`;
  }

  /**
   * Strip markdown code blocks from response
   */
  private stripMarkdownCodeBlocks(content: string): string {
    // Remove ```json ... ``` or ``` ... ```
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }
}

export const requirementAnalyzer = RequirementAnalyzer.getInstance();
