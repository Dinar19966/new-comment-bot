import { firstValueFrom } from 'rxjs';
import { DateTime } from 'luxon';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/common/redis/redis.service';
import { ApiPost, PostDto } from './post.interface';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);
  private readonly apiUrl: string;
  private readonly postsLimit: number;
  private readonly maxPostAgeDays: number;
  private readonly categoryId?: string;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('POST_API_URL');
    this.postsLimit = this.configService.get<number>('POSTS_LIMIT', 30);
    this.maxPostAgeDays = this.configService.get<number>(
      'MAX_POST_AGE_DAYS',
      200,
    );
    this.categoryId = this.configService.get<string>('POST_CATEGORY_ID'); // ← не getOrThrow, т.к. опционально
  }

  async getRecentPosts(): Promise<PostDto[]> {
    try {
      this.logger.debug('Fetching recent posts from API');

      const params: Record<string, any> = {
        limit: this.postsLimit,
        offset: 0,
        isIdea: false,
      };

      if (this.categoryId) {
        params.categoryId = this.categoryId;
      }

      // 👇 Лог запроса с параметрами
      const queryString = new URLSearchParams(params).toString();
      const fullUrl = `${this.apiUrl}?${queryString}`;
      this.logger.error(`🔍 DEBUG: Requesting: ${fullUrl}`);

      const response = await firstValueFrom(
        this.http.get<{ items: ApiPost[]; total: number }>(this.apiUrl, {
          params,
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
          },
        }),
      );

      const posts = response.data.items;

      if (!Array.isArray(posts)) {
        throw new Error('Unexpected API response: items is not an array');
      }

      const cutoffDate = DateTime.now().minus({ days: this.maxPostAgeDays });

      const recentPosts = posts.filter((post) => {
        const isNew = DateTime.fromISO(post.createdAt) > cutoffDate;
        const hasNoComments = post.commentsCount === 0;
        return isNew && hasNoComments;
      });

      const filteredPosts: PostDto[] = [];
      for (const post of recentPosts) {
        const isSeen = await this.redisService.isAlreadyCommented(post.id);
        if (!isSeen) {
          filteredPosts.push({
            id: post.id,
            text: this.extractPostText(post),
            createdAt: post.createdAt,
          });
        }
      }

      this.logger.log(`Found ${filteredPosts.length} suitable posts`);

      return filteredPosts;
    } catch (error) {
      this.logger.error('Failed to fetch posts', error.stack);
      throw new Error(`Post fetch failed: ${error.message}`);
    }
  }

  private extractPostText(post: ApiPost): string {
    return (
      post.plainTextWithoutLinks ||
      post.plainText ||
      post.title ||
      'Без текста'
    )
      .trim()
      .substring(0, 500);
  }

  async markPostAsProcessed(postId: string): Promise<void> {
    await this.redisService.markAsCommented(postId);
    this.logger.debug(`Marked post ${postId} as processed`);
  }
}
