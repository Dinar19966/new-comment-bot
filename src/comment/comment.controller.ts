import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { CommentService } from './comment.service';
import { LoggingInterceptor } from 'src/common/interseptors/logging.interseptor';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Comments')
@Controller('comments')
@UseInterceptors(LoggingInterceptor)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @ApiOperation({ summary: 'Generate and post comment' })
  @ApiResponse({ status: 200, description: 'Comment posted successfully' })
  @ApiResponse({ status: 400, description: 'No available posts found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async generateAndPostComment() {
    const result = await this.commentService.generateAndSendComment();
    return {
      success: result,
      message: result
        ? 'Comment posted successfully'
        : 'No available posts or posting failed',
    };
  }
}
