export interface ApiPost {
  id: string;
  createdAt: string;
  commentsCount: number;
  plainTextWithoutLinks?: string;
  plainText?: string;
  title: string;
}

export interface PostDto {
  id: string;
  text: string;
  createdAt: string;
}
