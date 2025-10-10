import { firstValueFrom } from 'rxjs'
import { DateTime } from 'luxon'
import { Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { RedisService } from 'src/common/redis/redis.service'
import { ApiPost, POST_API_URL, PostDto } from './post.interface'
import { POST_SERVICE_CONFIG } from './post.config'

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name)
  private readonly apiUrl: string
  private readonly postsLimit: number
  private readonly maxPostAgeDays: number
  private readonly categoryId?: string

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.apiUrl = POST_API_URL
    this.postsLimit = POST_SERVICE_CONFIG.POSTS_LIMIT
    this.maxPostAgeDays = POST_SERVICE_CONFIG.MAX_POST_AGE_DAYS
    this.categoryId = POST_SERVICE_CONFIG.POST_CATEGORY_ID
  }

  async getRecentPosts(filters?: { limit?: number; includeSeen?: boolean }): Promise<PostDto[]> {
    try {
      this.logger.debug('Fetching recent posts from API')

      const posts = await this.fetchRawPostsFromApi(filters?.limit)
      const filtered = await this.filterRecentPosts(posts, filters?.includeSeen ?? false)

      this.logger.log(`Found ${filtered.length} suitable posts`)
      return filtered
    } catch (error) {
      this.logger.error(`Failed to fetch posts: ${error.message}`, error.stack)
      throw new Error(`Post fetch failed: ${error.message}`)
    }
  }

  private async fetchRawPostsFromApi(limit = this.postsLimit): Promise<ApiPost[]> {
    const params: Record<string, any> = {
      limit,
      offset: 0,
      isIdea: false,
    }

    if (this.categoryId) {
      params.categoryId = this.categoryId
    }

    const queryString = new URLSearchParams(params).toString()
    const fullUrl = `${this.apiUrl}?${queryString}`
    this.logger.debug(`Requesting: ${fullUrl}`)

    const response = await firstValueFrom(
      this.http.get<{ items: ApiPost[] }>(this.apiUrl, {
        params,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      }),
    )

    if (!Array.isArray(response.data.items)) {
      throw new Error('Unexpected API response: items is not an array')
    }

    return response.data.items
  }

  private async filterRecentPosts(posts: ApiPost[], includeSeen = false): Promise<PostDto[]> {
    const cutoffDate = DateTime.now().minus({ days: this.maxPostAgeDays })

    const filteredPosts: PostDto[] = []

    for (const post of posts) {
      const isNew = DateTime.fromISO(post.createdAt) > cutoffDate
      const hasNoComments = post.commentsCount === 0

      if (!isNew || !hasNoComments) continue

      if (!includeSeen) {
        const isSeen = await this.redisService.isAlreadyCommented(post.id)
        if (isSeen) continue
      }

      filteredPosts.push({
        id: post.id,
        text: this.extractPostText(post),
        createdAt: post.createdAt,
      })
    }

    return filteredPosts
  }

  private extractPostText(post: ApiPost): string {
    return (
      post.plainTextWithoutLinks ||
      post.plainText ||
      post.title ||
      'Без текста'
    ).trim().substring(0, 500)
  }

  async markPostAsProcessed(postId: string): Promise<void> {
    await this.redisService.markAsCommented(postId)
    this.logger.debug(`Marked post ${postId} as processed`)
  }
}
