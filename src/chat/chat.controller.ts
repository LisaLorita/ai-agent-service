import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async handleChat(@Body() body: { message: string }) {
    const response = await this.chatService.sendChatMessage(body.message);
    return {
      message: response,
    };
  }
}
