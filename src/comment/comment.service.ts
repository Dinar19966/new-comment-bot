import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { GeneratorService } from 'src/generator/generator.service';
import { PostService } from 'src/post/post.service';
import { RedisService } from 'src/common/redis/redis.service';
import { PostDto } from 'src/post/post.interface';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  private readonly commentApiUrl: string;
  private readonly authToken: string;

  constructor(
    private readonly generatorService: GeneratorService,
    private readonly postService: PostService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.commentApiUrl =
      this.configService.getOrThrow<string>('COMMENT_API_URL');
    this.authToken = this.configService.getOrThrow<string>('X_AUTH_TOKEN');
  }

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
        this.logger.log(`✅ Successfully commented on https://finbazar.ru/post/${post.id}`);
      } else {
        this.logger.warn(`❌ Failed to comment on post ${post.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error('❌ Comment generation failed', error.stack);
      return false;
    }
  }

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

  private async generateValidComment(text: string): Promise<string> {
    const comment = await this.generatorService.generateComment(text);
    return comment.trim().substring(0, 500);
  }

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

  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      Cookie: `x-auth-token=${this.authToken}`,
    };
  }

  private async sendComment(postId: string, text: string): Promise<boolean> {
    const payload = this.buildCommentPayload(postId, text);
    const headers = this.getAuthHeaders();

    this.logger.debug(`📡 Sending POST to ${this.commentApiUrl}`);
    this.logger.verbose(
      `Payload: ${JSON.stringify(payload).substring(0, 300)}...`,
    );
    try {
      await firstValueFrom(
        this.httpService.post(this.commentApiUrl, payload, {
          headers,
        }),
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
