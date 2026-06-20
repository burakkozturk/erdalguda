import { request } from './client';

export interface BlogPostResponse {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  author: string | null;
  readTime: string | null;
  publishedAt: string;
}

export function getBlogPosts(): Promise<BlogPostResponse[]> {
  return request<BlogPostResponse[]>('/blog-posts');
}

export function getBlogPost(slug: string): Promise<BlogPostResponse> {
  return request<BlogPostResponse>(`/blog-posts/${slug}`);
}
