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

export const POST_API_URL="https://finbazar.ru/api/gate/post"
export const POST_CATEGORY_ID="740e8a83-61d9-4309-818c-85af564190b1"
export const POSTS_LIMIT=30
export const MAX_POST_AGE_DAYS=7
export const HTTP_TIMEOUT=5000
export const HTTP_MAX_REDIRECTS=3

export enum BlogCategoryId {
  INVESTING = 'f5c55b3a-7a24-41f6-a430-3de5505384e2',
  TRADING = 'd02225ab-d094-4a5b-8fb6-220245327c2e',
  CRYPTO = '740e8a83-61d9-4309-818c-85af564190b1',
  BONDS = '1ba5ec94-c463-423f-915d-93bd4cb67b43',
  REAL_ESTATE = '8594c60c-1f8e-41b0-8e70-43894bf34c8d',
  FIN_BAZAR = '41e3ea79-77aa-456d-970a-53448fca95e7',
  STOCKS = 'e883a6be-67bc-43b5-9e05-0b1aa35f0916',
  ECONOMY = 'ab8f6feb-26ab-477d-9803-5a6ab2194a49',
  MARKETS = 'b7bc2379-fe6b-43ea-96ee-cf8967507cf3',
  BUSINESS = '39de97dd-fc3c-40a9-aa77-dc8a6a120526',
  EDUCATION = 'f9c780aa-b6d4-481d-81c9-f6fefb10a96d',
  FUTURES = '76395ff6-84b1-42da-9177-c9d49fa4a939',
  OPTIONS = '745e057d-a17e-4a1a-a419-17b0b9366017',
  FUNDS = 'a8c510ba-f85d-41bb-9057-c6e002312271',
  HUMOR = 'e74e2a13-f110-45d5-9492-73cdeaac61d2',
  NEWS = 'b30a59bd-8b52-4f41-99ad-14872a0ddc1a',
}