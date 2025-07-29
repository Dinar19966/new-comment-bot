import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import { RedisService } from 'src/common/redis/redis.service';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly generationParams = {
    model: 'mistralai/mistral-7b-instruct', // можешь сменить модель в .env
    temperature: 0.6,
    maxTokens: 80,
    cacheTtl: 3600,
  };

  private openai: OpenAI;

  constructor(
    private readonly redisService: RedisService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1', // ⚠️ базовый путь OpenRouter
      defaultHeaders: {
        'HTTP-Referer': 'https://yourdomain.com', // ← желательно подставить реальный сайт
        'X-Title': 'Comment Generator',           // ← любое название
      },
    });
  }

  private hashText(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  private sanitizeComment(comment: string): string {
    return comment
      .replace(/[<>{}[\]\\]/g, '')
      .trim()
      .substring(0, 500);
  }

  async generateComment(text: string): Promise<string> {
    const startTime = Date.now();

    if (!text || text.trim().length < 5) {
      throw new BadRequestException('Text is too short');
    }

    if (text.length > 2000) {
      this.logger.warn(`Received long text (${text.length} chars), truncating`);
      text = text.substring(0, 2000);
    }

    const cacheKey = `comment:${this.hashText(text)}`;
    try {
      const cachedComment = await this.redisService.get(cacheKey);
      if (cachedComment) {
        this.logger.debug('Returning cached comment');
        return cachedComment;
      }

      this.logger.debug(`Generating comment for text: ${text.substring(0, 50)}...`);

      const  systemPrompt = `
Ты — талантливый, дружелюбный и искренний комментатор, который пишет короткие и естественные комментарии на русском языке. 
Твоя задача — поддержать автора поста, выразить интерес или задать лёгкий вопрос, показать эмпатию и позитивный настрой. 
Комментарий должен быть:
- релевантным содержанию поста,
- искренним, но не слишком эмоциональным,
- 1-2 предложения,
- без эмодзи и хэштегов,
- избегай клише и сухих формулировок.`

      const response = await this.openai.chat.completions.create({
        model: this.generationParams.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Пост: "${text.substring(0, 500)}"` },
        ],
        temperature: this.generationParams.temperature,
        max_tokens: this.generationParams.maxTokens,
        frequency_penalty: 0.5,
      });

      const result = this.sanitizeComment(response.choices[0]?.message?.content ?? '');

      if (!result || result.length < 2) {
        throw new Error('Invalid comment generated');
      }

      await this.redisService.set(cacheKey, result, this.generationParams.cacheTtl);

      this.logger.log(`Generated in ${Date.now() - startTime}ms: ${result.substring(0, 30)}...`);
      return result;

    } catch (error) {
      this.logger.error(`Failed in ${Date.now() - startTime}ms: ${error.message}`, {
        stack: error.stack,
        textSample: text.substring(0, 100),
      });
      throw new Error(`Comment generation failed: ${error.message}`);
    }
  }
}
