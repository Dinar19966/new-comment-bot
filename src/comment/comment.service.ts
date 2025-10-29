import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { GeneratorService } from 'src/generator/generator.service';
import { PostService } from 'src/post/post.service';
import { RedisService } from 'src/common/redis/redis.service';
import { PostDto } from 'src/post/post.interface';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  private readonly commentApiUrl: string;

  constructor(
    private readonly generatorService: GeneratorService,
    private readonly postService: PostService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly authService: AuthService, // интеграция с AuthService
  ) {
    this.commentApiUrl =
      this.configService.getOrThrow<string>('COMMENT_API_URL');
  }

  /** Основной метод: выбирает пост, генерирует и отправляет комментарий */
  async generateAndSendComment(): Promise<boolean> {
    this.logger.log('📤 Starting comment generation');
    try {
      const post = await this.findAvailablePost();
      if (!post) {
        this.logger.warn('⚠️ No available posts found');
        return false;
      }

      this.logger.debug(`📝 Selected post: ${post.id}`);

      const commentText = await this.generateValidComment(post.text);
      this.logger.debug(
        `💬 Generated comment: ${commentText.substring(0, 100)}...`,
      );

      const success = await this.sendComment(post.id, commentText);

      if (success) {
        this.logger.log(
          `✅ Successfully commented on https://finbazar.ru/post/${post.id}`,
        );
      } else {
        this.logger.warn(`❌ Failed to comment on post ${post.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error('❌ Comment generation failed', error.stack);
      return false;
    }
  }

  /** Находит первый доступный пост, на который ещё не был оставлен комментарий */
  private async findAvailablePost(): Promise<PostDto | null> {
    const posts = await this.postService.getRecentPosts();
    this.logger.debug(`🔍 Checking ${posts.length} posts for availability`);

    for (const post of posts) {
      const seen = await this.redisService.isAlreadyCommented(post.id);
      if (!seen) {
        this.logger.debug(`✅ Found available post: ${post.id}`);
        return post;
      } else {
        this.logger.debug(`⏩ Skipping already commented post: ${post.id}`);
      }
    }
    return null;
  }

  /** Генерация комментария через GeneratorService */
  private async generateValidComment(text: string): Promise<string> {
    const comment = await this.generatorService.generateComment(text);
    return comment.trim().substring(0, 500);
  }

  /** Формируем payload для API */
  private buildCommentPayload(postId: string, text: string) {
    return {
      postId,
      parentId: null,
      content: {
        editorState: {
          root: {
            type: 'root',
            indent: 0,
            version: 1,
            format: '',
            direction: null,
            children: [
              {
                version: 1,
                children: [
                  {
                    type: 'text',
                    style: '',
                    format: 0,
                    mode: 'normal',
                    version: 1,
                    detail: 0,
                    text,
                  },
                ],
                format: '',
                type: 'paragraph',
                indent: 0,
                direction: null,
              },
            ],
          },
        },
      },
    };
  }

  /** Генерация заголовков с динамическим токеном от AuthService */
  private getAuthHeaders(token: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  /** Отправка комментария через API */
  private async sendComment(postId: string, text: string): Promise<boolean> {
    // выбираем случайный аккаунт
    const accounts = await this.authService.listAccounts();
    if (!accounts.length) {
      this.logger.warn('⚠️ Нет доступных аккаунтов');
      return false;
    }
    const account = accounts[Math.floor(Math.random() * accounts.length)];
    const token = await this.authService.getAccessToken(account.id);

    const payload = this.buildCommentPayload(postId, text);
    const headers = this.getAuthHeaders(token);

    this.logger.debug(`📡 Sending POST to ${this.commentApiUrl}`);
    this.logger.verbose(
      `Payload: ${JSON.stringify(payload).substring(0, 300)}...`,
    );

    try {
      await firstValueFrom(
        this.httpService.post(this.commentApiUrl, payload, { headers }),
      );

      await this.redisService.markAsCommented(postId);
      this.logger.debug(`🧠 Marked post ${postId} as processed in Redis`);
      return true;
    } catch (error) {
      this.logger.error(`🚫 Failed to post comment to ${postId}`, {
        error: error.message,
        textSample: text.substring(0, 100),
      });
      return false;
    }
  }
}
