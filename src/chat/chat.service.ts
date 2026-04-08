import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
  }

  async sendChatMessage(message: string): Promise<string> {
    this.logger.log(`Message received: ${message}`);

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        tools: [{ functionDeclarations: [this.getUserInfoDeclaration] }],
      });

      const result = await model.generateContent(message);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        return this.handleFunctionCalls(message, functionCalls);
      }

      return response.text() || 'The AI did not return a response.';
    } catch (error) {
      const errorMessage = error?.message || 'Unknown Gemini error';
      this.logger.error(`Gemini Error: ${errorMessage}`);
      if (errorMessage.includes('[429')) {
        return "The AI service has exceeded its available quota. Check Gemini's rate limit and try again in a few minutes.";
      }
      if (errorMessage.includes('[404')) {
        return 'The model specified in GEMINI_MODEL does not exist or is not supported. Adjust the model and try again.';
      }
      return 'The AI service is currently experiencing issues. Please try again later.';
    }
  }

  private async handleFunctionCalls(
    originalMessage: string,
    functionCalls: any[],
  ): Promise<string> {
    const call = functionCalls[0];
    this.logger.log(`Gemini decided to use function: ${call.name}`);

    if (call.name === 'getUserInfoById') {
      const userId = (call.args as any).id;
      const userData = await this.fetchExternalUserInfo(userId);

      if (!userData) {
        return 'Internal error: Could not retrieve user information from the primary system.';
      }

      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const history = [
        { role: 'user', parts: [{ text: originalMessage }] },
        { role: 'model', parts: [{ functionCall: { name: call.name, args: call.args } }] },
        { role: 'user', parts: [{ functionResponse: { name: call.name, response: userData } }] },
      ];
      const result = await model.generateContent({ contents: history });

      return result.response.text() || 'The AI did not return a text response after processing the data.';
    }

    return 'Function call not supported.';
  }

  private async fetchExternalUserInfo(userId: string): Promise<any> {
    const baseUrl = this.configService.get<string>('SPRING_BOOT_API_URL');
    if (!baseUrl) {
      this.logger.error('SPRING_BOOT_API_URL is not configured');
      return null;
    }

    try {
      this.logger.log(`Querying Spring Boot API for user: ${userId}`);
      const apiResult = await firstValueFrom(
        this.httpService.get(`${baseUrl}/${userId}`),
      );
      this.logger.log(`Data successfully retrieved for user ${userId}`);
      return apiResult.data;
    } catch (error) {
      this.logger.error(`Failed to fetch user data from API: ${error.message}`);
      return null;
    }
  }

  private get getUserInfoDeclaration(): any {
    return {
      name: 'getUserInfoById',
      description: 'Fetches detailed user information from the database using a numeric or UUID string ID.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique identifier (UUID) of the user. Example: 550e8400-e29b-41d4-a716-446655440000',
          },
        },
        required: ['id'],
      },
    };
  }
}
