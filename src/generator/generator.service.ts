import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import * as crypto from 'crypto'
import { RedisService } from 'src/common/redis/redis.service'
import { systemPrompts } from './prompts'
import { DEFAULT_GENERATION_PARAMS, POST_MAX_TEXT_LENGTH } from './config'

interface GenerateOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  style?: 'support' | 'question' | 'neutral'
}
@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name)
  private openai: OpenAI

  constructor(private readonly redisService: RedisService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1', 
    })
  }

  private hashText(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex')
  }

  private sanitizeComment(comment: string): string {
    return comment
      .replace(/[<>{}[\]\\]/g, '')
      .trim()
      .substring(0, 500)
  }

  private getRandomPrompt(): string {
    const index = Math.floor(Math.random() * systemPrompts.length)
    return systemPrompts[index]
  }

  async generateComment(text: string, options: GenerateOptions = {}): Promise<string> {
    const startTime = Date.now()

    if (!text || text.trim().length < 50) {
      throw new BadRequestException('Text is too short')
    }

    if (text.length > POST_MAX_TEXT_LENGTH) {
      this.logger.warn(`Received long text (${text.length} chars), truncating`);
      text = text.substring(0, POST_MAX_TEXT_LENGTH)
    }

    const cacheKey = `comment:${this.hashText(text)}:${options.style ?? 'default'}`
    const cachedComment = await this.redisService.get(cacheKey)
    if (cachedComment) {
        this.logger.debug('Returning cached comment')
        return cachedComment
      }

    this.logger.debug(
        `Generating comment for text: ${text.substring(0, 50)}...`,
      )
    
    const model = options.model ?? DEFAULT_GENERATION_PARAMS.model
    const maxTokens = options.maxTokens ?? DEFAULT_GENERATION_PARAMS.maxTokens
    const temperature = options.temperature ?? DEFAULT_GENERATION_PARAMS.temperature
    const retryCount = DEFAULT_GENERATION_PARAMS.retryCount

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.getRandomPrompt() },
      { role: 'user', content: `Пост: "${text.substring(0, 500)}"` },
    ]

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          frequency_penalty: 0.5,
        })
      
      const result = this.sanitizeComment(
        response.choices[0]?.message?.content ?? '',
      )

      if (!result || result.length < 2) {
        throw new Error('Invalid comment generated')
      }

      await this.redisService.set(
        cacheKey,
        result,
        DEFAULT_GENERATION_PARAMS.cacheTtl
      )

      this.logger.log(
        `Generated in ${Date.now() - startTime}ms: ${result.substring(0, 30)}...`,
      )

      return result
    } catch (error) {
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`)
        if (attempt === retryCount) {
          this.logger.error('All retries failed', { error })
          throw new Error(`Comment generation failed: ${error.message}`)
        }
        await new Promise((res) => setTimeout(res, 1000 * attempt))
      }
    }
    throw new Error('Unexpected failure')
  }
}
