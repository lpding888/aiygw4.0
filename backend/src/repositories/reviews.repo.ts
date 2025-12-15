/**
 * 用户评价仓库层
 */

import { db } from '../config/database.js';

export interface Review {
  id: number;
  user_id?: number;
  user_name?: string;
  user_avatar?: string;
  rating: number;
  title?: string;
  content?: string;
  images?: string;
  product_type?: string;
  task_id?: number;
  is_verified: boolean;
  is_featured: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  admin_reply?: string;
  admin_reply_at?: Date;
  helpful_count: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReviewInput {
  user_id?: number;
  user_name?: string;
  user_avatar?: string;
  rating: number;
  title?: string;
  content?: string;
  images?: string[];
  product_type?: string;
  task_id?: number;
}

export async function listReviews(
  options: {
    status?: string;
    isFeatured?: boolean;
    rating?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<Review[]> {
  let query = db<Review>('reviews').orderBy('created_at', 'desc');
  if (options.status) query = query.where('status', options.status);
  if (options.isFeatured !== undefined) query = query.where('is_featured', options.isFeatured);
  if (options.rating) query = query.where('rating', options.rating);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.offset(options.offset);
  return query;
}

export async function getApprovedReviews(
  options: { limit?: number; isFeatured?: boolean } = {}
): Promise<Review[]> {
  let query = db<Review>('reviews')
    .where('status', 'approved')
    .orderByRaw('is_featured DESC, sort_order ASC');
  if (options.isFeatured) query = query.where('is_featured', true);
  if (options.limit) query = query.limit(options.limit);
  return query;
}

export async function getAverageRating(): Promise<{ average: number; count: number }> {
  const result = await db('reviews')
    .where('status', 'approved')
    .avg('rating as average')
    .count('id as count')
    .first();
  return {
    average: parseFloat(result?.average || '0'),
    count: parseInt((result?.count as string) || '0')
  };
}

export async function getReviewById(id: number): Promise<Review | undefined> {
  return db<Review>('reviews').where('id', id).first();
}

export async function createReview(data: CreateReviewInput): Promise<Review> {
  const serialized = { ...data, images: data.images ? JSON.stringify(data.images) : undefined };
  const [id] = await db('reviews').insert(serialized);
  return getReviewById(id) as Promise<Review>;
}

export async function updateReview(id: number, data: Partial<Review>): Promise<Review> {
  await db('reviews')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() });
  return getReviewById(id) as Promise<Review>;
}

export async function deleteReview(id: number): Promise<boolean> {
  return (await db('reviews').where('id', id).delete()) > 0;
}

export async function approveReview(id: number): Promise<Review> {
  return updateReview(id, { status: 'approved' });
}

export async function replyToReview(id: number, reply: string): Promise<Review> {
  await db('reviews')
    .where('id', id)
    .update({ admin_reply: reply, admin_reply_at: db.fn.now(), updated_at: db.fn.now() });
  return getReviewById(id) as Promise<Review>;
}
